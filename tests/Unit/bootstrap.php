<?php
define('ABSPATH', '/isolated-test/');
function __($message, $domain = '') { return $message; }
function esc_html__($message, $domain = '') { return esc_html(__($message, $domain)); }
function wp_json_encode($value) { return json_encode($value); }
function esc_html($value) { return htmlspecialchars($value, ENT_QUOTES, 'UTF-8'); }
function sanitize_text_field($value) { return trim(strip_tags($value)); }
function sanitize_key($value) { return preg_replace('/[^a-z0-9_-]/', '', strtolower($value)); }
function wp_kses($value, $allowed, $protocols) { return strip_tags($value, '<p><b><strong>'); }
require dirname(__DIR__, 2) . '/includes/Schema.php';
require dirname(__DIR__, 2) . '/includes/Data.php';
