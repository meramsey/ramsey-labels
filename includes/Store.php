<?php
/** Independent option storage with optimistic concurrency; never writes vendor settings. */
namespace RamseyLabels;
if (!defined('ABSPATH')) { exit; }

final class Store
{
    const OPTION = 'rli_v1_library';
    const JOBS = 'rli_v1_jobs';
    const BACKUP = 'rli_v1_migration_backup';

    public static function read()
    {
        $raw = get_option(self::OPTION, null);
        $library = is_array($raw) ? $raw : Schema::defaults();
        // Upgrade only the untouched original 2x1 thermal design to the new
        // QR-card default. Custom designs, profiles and saved print settings stay intact.
        if (isset($library['profiles']) && is_array($library['profiles'])) {
            foreach ($library['profiles'] as &$profile) {
                if (($profile['id'] ?? '') !== 'thermal-2x1' || !isset($profile['design']['elements'])) { continue; }
                $elements = $profile['design']['elements'];
                if (count($elements) !== 4) { continue; }
                $ids = array_column($elements, 'id');
                if ($ids !== array('title', 'barcode', 'sku', 'price')) { continue; }
                if (($profile['design']['width'] ?? null) != 50.8 || ($profile['design']['height'] ?? null) != 25.4) { continue; }
                if (($elements[1]['format'] ?? '') !== 'code128'
                    || ($elements[1]['content'] ?? '') !== '{{sku|id}}'
                    || ($elements[1]['x'] ?? null) != 1.5 || ($elements[1]['y'] ?? null) != 7
                    || ($elements[1]['w'] ?? null) != 47.8 || ($elements[1]['h'] ?? null) != 9) { continue; }
                $profile['design'] = Schema::defaults()['profiles'][0]['design'];
            }
            unset($profile);
        }
        // RC1 shipped a QR preset that encoded the permalink, which WCPOS cannot
        // look up as a SKU. Repair only that exact factory expression; preserve
        // intentionally configured URL QR codes and all other custom layouts.
        foreach (array('templates', 'profiles') as $group) {
            if (empty($library[$group]) || !is_array($library[$group])) { continue; }
            foreach ($library[$group] as &$entry) {
                if (!isset($entry['design']['elements']) || !is_array($entry['design']['elements'])) { continue; }
                foreach ($entry['design']['elements'] as &$element) {
                    if (isset($element['type'], $element['content']) && $element['type'] === 'barcode'
                        && $element['content'] === '{{product_url|sku|id}}') {
                        $element['content'] = '{{sku|id}}';
                    }
                }
                unset($element);
            }
            unset($entry);
        }
        return $library;
    }

    public static function accessible(array $profile)
    {
        if (current_user_can('manage_options') || empty($profile['roles'])) { return true; }
        return (bool) array_intersect((array) wp_get_current_user()->roles, $profile['roles']);
    }

    public static function visible(array $library)
    {
        $library['profiles'] = array_values(array_filter($library['profiles'], array(__CLASS__, 'accessible')));
        if (!$library['profiles']) {
            $profile = Schema::defaults()['profiles'][0]; $profile['id'] = 'personal-' . get_current_user_id(); $profile['name'] = 'Personal print profile';
            $library['profiles'][] = $profile;
        }
        if (!in_array($library['defaultProfile'], array_column($library['profiles'], 'id'), true)) { $library['defaultProfile'] = $library['profiles'][0]['id']; }
        return $library;
    }

    public static function save(array $incoming, $trusted = false)
    {
        global $wpdb;
        $stored = get_option(self::OPTION, null); $old = is_array($stored) ? $stored : Schema::defaults();
        $clean = Schema::library($incoming);
        if ((int) $clean['revision'] !== (int) $old['revision']) { throw new \DomainException('Settings changed in another browser tab. Export your edits, reload, then reapply them.'); }
        if (!$trusted && !current_user_can('manage_options')) {
            $old_profiles = array(); foreach ($old['profiles'] as $p) { $old_profiles[$p['id']] = $p; }
            foreach ($clean['profiles'] as &$p) {
                if (isset($old_profiles[$p['id']]) && !self::accessible($old_profiles[$p['id']])) { throw new \RuntimeException('A restricted profile cannot be edited.'); }
                $p['roles'] = isset($old_profiles[$p['id']]) ? $old_profiles[$p['id']]['roles'] : array();
            }
            unset($p);
            foreach ($old['profiles'] as $p) { if (!self::accessible($p)) { $clean['profiles'][] = $p; } }
            $clean = Schema::library($clean);
        }
        $clean['revision'] = (int) $old['revision'] + 1;
        if ($stored === null) {
            $success = add_option(self::OPTION, $clean, '', false);
        } else {
            // Compare-and-swap prevents silent loss of edits from simultaneous requests.
            $success = $wpdb->update($wpdb->options, array('option_value' => maybe_serialize($clean)), array('option_name' => self::OPTION, 'option_value' => maybe_serialize($stored)), array('%s'), array('%s', '%s'));
            wp_cache_delete(self::OPTION, 'options');
        }
        if (!$success) { throw new \DomainException('The save conflicted with another update or the database rejected it. Reload before saving again.'); }
        return self::visible($clean);
    }

    public static function jobs()
    {
        $jobs = get_user_meta(get_current_user_id(), self::JOBS, true);
        return is_array($jobs) ? $jobs : array();
    }

    public static function updateJob(array $request)
    {
        $jobs = self::jobs(); $action = Schema::choice(isset($request['action']) ? $request['action'] : 'save', array('save', 'delete', 'clear'));
        if ($action === 'clear') { delete_user_meta(get_current_user_id(), self::JOBS); return array(); }
        $id = Schema::identifier($request['id']);
        if ($action === 'delete') { unset($jobs[$id]); }
        else {
            if (empty($request['privacy_acknowledged'])) { throw new \InvalidArgumentException('Acknowledge that saved jobs may contain customer data.'); }
            if (!isset($jobs[$id]) && count($jobs) >= 10) { throw new \InvalidArgumentException('Delete a saved job before adding another (maximum 10).'); }
            $jobs[$id] = array('id' => $id, 'name' => sanitize_text_field(Schema::text($request['name'], 150)), 'created' => gmdate('c'), 'profileId' => Schema::identifier($request['profileId']), 'records' => Schema::records($request['records']));
        }
        if (strlen(wp_json_encode($jobs)) > 2000000) { throw new \InvalidArgumentException('Saved jobs exceed the 2 MB per-user limit. Export CSV locally instead.'); }
        update_user_meta(get_current_user_id(), self::JOBS, $jobs);
        return $jobs;
    }
}
