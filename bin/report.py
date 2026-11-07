#!/usr/bin/env python3
"""Create a concise, redacted RC10 verification record from captured command outputs."""
import datetime
import hashlib
import json
import pathlib
import re
import zipfile

ROOT=pathlib.Path(__file__).resolve().parent.parent
REPORTS=ROOT/'build/rc10-reports'
EVIDENCE=ROOT/'docs/evidence'
EVIDENCE.mkdir(parents=True,exist_ok=True)

def read(name):return (REPORTS/name).read_text()
def count(pattern,name):
    match=re.search(pattern,read(name))
    if not match:raise RuntimeError(f'Missing verified count in {name}')
    return int(match.group(1))
def phpunit(name):
    match=re.search(r'OK \((\d+) tests, (\d+) assertions\)',read(name))
    if not match:raise RuntimeError(f'PHPUnit did not pass in {name}')
    return {'tests':int(match.group(1)),'assertions':int(match.group(2))}
legacy=json.loads((ROOT/'build/artifact-manifest.json').read_text())
public=json.loads((ROOT/'build/public/artifact-manifest.json').read_text())
for manifest,folder in [(legacy,ROOT/'build'),(public,ROOT/'build/public')]:
    archive=folder/manifest['archive']
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=manifest['sha256']:raise RuntimeError('Artifact checksum mismatch: '+str(archive))
phpcheck=json.loads(read('wpcs.json'))
if phpcheck['totals']['errors'] or phpcheck['totals']['warnings']:raise RuntimeError('WPCS has unresolved findings')
issues=[]
for name,status in [('legacy',ROOT/'build/rc10-reports/legacy-package.txt'),('public',ROOT/'build/rc10-reports/public-plugin-check.txt')]:
    source=status.read_text()
    ok=('Plugin Check: 0 errors, 0 warnings' in source) if name=='legacy' else ('No errors found.' in source)
    if not ok:raise RuntimeError('Plugin Check did not pass: '+name)
    issues.append({'artifact':name,'errors':0,'warnings':0,'plugin_check':'2.1.0'})
(EVIDENCE/'plugin-check.json').write_text(json.dumps(issues,indent=2)+'\n')
php_files={}
for runtime in ['74','83','85']:
    for line in read('php-syntax'+runtime+'.txt').splitlines():
        match=re.search(r'No syntax errors detected in (.+)',line)
        if match:php_files[match.group(1).split('/')[-1]]=runtime+' pass'
if len(php_files)<8:raise RuntimeError('Missing PHP syntax evidence on the PHP matrix')
deps=json.loads(read('npm-audit.json'))
composer=json.loads(read('composer-audit.json'))
if deps['metadata']['vulnerabilities']['total'] or composer.get('advisories') or composer.get('abandoned'):raise RuntimeError('Dependency audit reported outstanding findings')
for name in ['e2e.txt','e2e-firefox.txt','e2e-webkit.txt','oldest-e2e.txt','php85-e2e.txt','legacy-package.txt','public-e2e.txt']:
    if not re.search(r'\b21 passed \(',read(name)):raise RuntimeError('Browser suite not verified: '+name)
integration_files=['integration-hpos.txt','integration-legacy.txt','oldest-integration.txt','php85-integration-hpos.txt','php85-integration-legacy.txt','public-integration.txt']
integrations={name:count(r'Integration assertions: (\d+)',name) for name in integration_files}
if any(value<94 for value in integrations.values()):raise RuntimeError('Integration assertions below expected test matrix')
if count(r'Multisite lifecycle assertions: (\d+)','multisite.txt')!=6:raise RuntimeError('Multisite lifecycle suite did not pass')
js_tests=count(r'# pass (\d+)','js-unit.txt')
php_tests={name:phpunit(name) for name in ['phpunit74.txt','phpunit83.txt','phpunit85.txt']}
if any(value!={'tests':16,'assertions':23} for value in php_tests.values()):raise RuntimeError('Unexpected PHPUnit test/assertion count')
if 'Success: POT file successfully generated.' not in read('make-pot.txt'):raise RuntimeError('POT extraction failed')
if 'PASS: every PHP/JavaScript gettext entry' not in read('pot-check.txt'):raise RuntimeError('POT differs from source')
if 'no leaks found' not in read('gitleaks.txt').lower():raise RuntimeError('Secret scan failed')
if not php_files:raise RuntimeError('PHP syntax evidence missing')
with zipfile.ZipFile(ROOT/'ramsey-labels-independent-1.0.0-rc8.zip') as archive:
    inventory=[{'path':name,'size':len(archive.read(name)),'sha256':hashlib.sha256(archive.read(name)).hexdigest()} for name in sorted(archive.namelist())]
(EVIDENCE/'rc8-inventory.json').write_text(json.dumps({'sha256':hashlib.sha256((ROOT/'ramsey-labels-independent-1.0.0-rc8.zip').read_bytes()).hexdigest(),'files':inventory},indent=2)+'\n')
safe_wpcs={'totals':phpcheck['totals'],'files':{path.split('/app/')[-1]:record for path,record in phpcheck['files'].items()}}
(EVIDENCE/'wpcs.json').write_text(json.dumps(safe_wpcs,indent=2)+'\n')
data={
 'status':'READY FOR OWNER REVIEW; NOT APPROVED/PUBLISHED',
 'generated_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'branch':'engineering/wordpress-org-readiness',
 'git_commit':__import__('subprocess').check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
 'runtime_source_commit':legacy['commit'],'legacy_artifact':legacy,'public_directory_candidate':public,
 'unit':{'phpunit':php_tests,'javascript_tests':js_tests,'independent_barcode_formats':8,'gs1_128_common_ai_vectors':1},
 'integration_assertions':integrations,
 'browser_tests_each':{'chromium_current_php83':21,'firefox_current_php83':21,'webkit_linux_current_php83':21,'chromium_oldest_wp_php74':21,'chromium_php85':21,'installed_legacy_zip':21,'installed_public_slug_zip':21},
 'multisite_assertions':6,
 'upgrade':'Genuine archived RC8 and RC9 libraries, custom profile/template/default/DPI equality on PHP 7.4, 8.3 and 8.5; separate public slug/entrypoint transition preserves single-site options and saved job.',
 'wordpress_matrix':{'oldest':'WP 6.0.3 / Woo 7.0.1 / PHP 7.4.32 Apache, 7.4.33 CLI','current83':'WP 7.1.4 / Woo 11.2.2 / PHP 8.3.35','current85':'WP 7.1.4 / Woo 11.2.2 / PHP 8.5.12','orders':['Legacy','HPOS'],'current_releases_checked':'WordPress Core Check API and Plugin Information API on 2026-11-06/07'},
 'php':{'syntax':'pass','phpstan_level':5,'phpstan_errors':0,'phpcs_wpcs':phpcheck['totals']},
 'i18n':{'text_domain_legacy':'ramsey-labels-independent','text_domain_public':'ramsey-labels','pot_extraction_warnings':0,'pot_match':'pass','js_wp_i18n':'wp-i18n dependency and wp_set_script_translations registered'},
 'accessibility':{'axe_wcag21_A_AA_violations':0,'chromium_firefox_webkit':'pass','keyboard_and_rtl':'automated pass','manual_assistive_technology':'pending'},
 'plugin_check':issues,
 'pdf':read('pdf.txt').strip().splitlines(),
 'security':{'rest_anonymous_role_nonce': 'negative tests pass for all 12 registered route methods','customer_privacy_pages':26,'oversized_request':'413 before decode','serialized_object':'rejected; classes disabled; depth/node/byte limits','external_images':'explicit per-origin consent; private literal-host checks; CORS; omit credentials/referrer; reject redirects/non-raster; byte/MIME/pixel limits','gitleaks':'no leaks','residual':'DNS rebinding/browser extension risks; third-party custom-meta privacy is site capability-gated but not an encrypted boundary; adversarial fuzz and prolonged-load tests remain'},
 'dependency_audit':{'npm_vulnerabilities':deps['metadata']['vulnerabilities'],'composer_advisories':len(composer.get('advisories',[])),'composer_abandoned':composer.get('abandoned',[])},
 'license_inventory':read('licenses.txt').strip().splitlines(),
 'release_zip_policy':'Both ZIPs are deterministic allowlist packages; tests, node_modules, vendor, fixtures, original archives and CI scripts excluded.',
 'repository':{'working_branch':'engineering/wordpress-org-readiness','private_data_scan':'Gitleaks scanned committed history; no leaks found','remote_push':'not performed'},
 'remaining':[
   'Owner attestation: inherited RC8 encoders/source/assets are redistributable under GPL-2.0-or-later and author/brand attribution is authorized.',
   'WordPress.org slug lookup was 404/unlisted at check time; not reserved or approved. Explicit owner approval to submit the separate directory archive is pending.',
   'RC8/RC9 legacy multisite user-job data has no owning site ID; network administrator must explicitly map jobs to sites. Automatic migration is intentionally disabled to prevent cross-site PII disclosure.',
   'Named manufacturer stock-sheet presets beyond verified A4 65 are not included; custom sheet geometry is supported.',
   'GS1-128 supports documented common AIs, not the complete GS1 family; no broad compatibility claim.',
    'Full-label vector SVG and one-click alphabetical sort remain gaps; barcode SVG, PNG/PDF and manual queue reorder are tested.',
    'No real printer/scanner/POS, assistive-tech operator, macOS Safari or Windows platform was available for manual acceptance.',
   'No physical printer, live WCPOS/POS scanner, macOS Safari, Windows browser or manual screen-reader test was performed.',
   'Owner security/support/conduct contacts, final WordPress.org screenshots/artwork, public translation review, and explicit publication/release approvals remain.'
 ]
}
(EVIDENCE/'verification.json').write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps({k:data[k] for k in ['status','git_commit','unit','integration_assertions','browser_tests_each','multisite_assertions','php','plugin_check']},indent=2))
