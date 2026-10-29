<?php
/**
 * Plugin Name: KL Cabinet Auth
 * Description: Проверка пароля WordPress для кабинета уроков. Оплату не проводит.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

function kl_cab_secret(): string
{
    $secret = trim((string) get_option('kl_cabinet_shared_secret', ''));
    if (strlen($secret) < 32) {
        return '';
    }
    return $secret;
}

function kl_cab_authorized(): bool
{
    $secret = kl_cab_secret();
    $got = isset($_SERVER['HTTP_X_KL_CABINET']) ? (string) $_SERVER['HTTP_X_KL_CABINET'] : '';
    if ($secret === '' || $got === '') {
        return false;
    }
    return hash_equals($secret, $got);
}

function kl_cab_json(array $payload, int $status = 200): void
{
    nocache_headers();
    status_header($status);
    header('Content-Type: application/json; charset=utf-8');
    echo wp_json_encode($payload);
    exit;
}

function kl_cab_login_name(string $raw): string
{
    $raw = trim(sanitize_text_field(wp_unslash($raw)));
    if ($raw === '') {
        return '';
    }
    if (is_email($raw)) {
        $user = get_user_by('email', $raw);
        if ($user instanceof WP_User) {
            return $user->user_login;
        }
    }
    return $raw;
}

function kl_cab_rate_blocked(string $bucket): bool
{
    return (int) get_transient('klcab_' . $bucket) >= 8;
}

function kl_cab_rate_hit(string $bucket): void
{
    $key = 'klcab_' . $bucket;
    $n = (int) get_transient($key);
    set_transient($key, $n + 1, 15 * MINUTE_IN_SECONDS);
}

function kl_cab_access_for(int $uid): array
{
    $user = get_userdata($uid);
    if (!$user instanceof WP_User) {
        return ['ok' => false];
    }
    $has = false;
    $until = 0;
    if (function_exists('kl_baza_access_bundle_for_uid')) {
        $bundle = kl_baza_access_bundle_for_uid($uid);
        $has = !empty($bundle['has_minimum_access']) || !empty($bundle['is_unlimited_access']) || !empty($bundle['is_staff_account']);
        $until = (int) ($bundle['access_until_unix'] ?? 0);
    } elseif (function_exists('kl_sub_user_has_tier')) {
        $has = kl_sub_user_has_tier($uid, 'video') || kl_sub_user_has_tier($uid, 'articles');
        $until = max(
            function_exists('kl_sub_video_until_ts') ? (int) kl_sub_video_until_ts($uid) : 0,
            function_exists('kl_sub_articles_until_ts') ? (int) kl_sub_articles_until_ts($uid) : 0
        );
    }
    return [
        'ok' => true,
        'uid' => $uid,
        'name' => (string) $user->display_name,
        'email' => (string) $user->user_email,
        'has_access' => $has,
        'access_until' => $until,
    ];
}

function kl_cab_login(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !kl_cab_authorized()) {
        kl_cab_json(['ok' => false], 404);
    }
    $email = strtolower(trim(sanitize_email(wp_unslash((string) ($_POST['email'] ?? '')))));
    $password = isset($_POST['password']) ? (string) wp_unslash($_POST['password']) : '';
    if ($email === '' || $password === '' || strlen($password) > 200) {
        kl_cab_json(['ok' => false, 'error' => 'auth'], 401);
    }
    $bucket = md5($email);
    if (kl_cab_rate_blocked($bucket)) {
        kl_cab_json(['ok' => false, 'error' => 'rate'], 429);
    }
    $login = kl_cab_login_name($email);
    $user = $login !== '' ? wp_authenticate($login, $password) : new WP_Error('invalid');
    if (!$user instanceof WP_User) {
        kl_cab_rate_hit($bucket);
        kl_cab_json(['ok' => false, 'error' => 'auth'], 401);
    }
    kl_cab_json(kl_cab_access_for((int) $user->ID));
}

function kl_cab_access(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !kl_cab_authorized()) {
        kl_cab_json(['ok' => false], 404);
    }
    $uid = isset($_POST['uid']) ? (int) $_POST['uid'] : 0;
    if ($uid <= 0) {
        kl_cab_json(['ok' => false], 404);
    }
    $payload = kl_cab_access_for($uid);
    if (empty($payload['ok'])) {
        kl_cab_json(['ok' => false], 404);
    }
    kl_cab_json($payload);
}

function kl_cab_go(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        status_header(405);
        exit;
    }
    nocache_headers();
    if (!is_user_logged_in()) {
        wp_safe_redirect(home_url('/login'));
        exit;
    }
    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    set_transient('klgo_' . hash('sha256', $token), (int) get_current_user_id(), 90);
    header('Referrer-Policy: no-referrer');
    header('Location: https://baza.kinologlife.online/enter?t=' . rawurlencode($token), true, 302);
    exit;
}

function kl_cab_redeem(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !kl_cab_authorized()) {
        kl_cab_json(['ok' => false], 404);
    }
    $token = isset($_POST['token']) ? (string) wp_unslash($_POST['token']) : '';
    if (!preg_match('/^[A-Za-z0-9_-]{20,128}$/', $token)) {
        kl_cab_json(['ok' => false], 401);
    }
    $key = 'klgo_' . hash('sha256', $token);
    $uid = (int) get_transient($key);
    delete_transient($key);
    if ($uid <= 0) {
        kl_cab_json(['ok' => false], 401);
    }
    $payload = kl_cab_access_for($uid);
    if (empty($payload['ok'])) {
        kl_cab_json(['ok' => false], 401);
    }
    kl_cab_json($payload);
}

add_action('admin_post_nopriv_kl_cabinet_login', 'kl_cab_login');
add_action('admin_post_kl_cabinet_login', 'kl_cab_login');
add_action('admin_post_nopriv_kl_cabinet_access', 'kl_cab_access');
add_action('admin_post_kl_cabinet_access', 'kl_cab_access');
add_action('admin_post_nopriv_kl_cabinet_go', 'kl_cab_go');
add_action('admin_post_kl_cabinet_go', 'kl_cab_go');
add_action('admin_post_nopriv_kl_cabinet_redeem', 'kl_cab_redeem');
add_action('admin_post_kl_cabinet_redeem', 'kl_cab_redeem');
