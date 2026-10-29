<?php
/**
 * Plugin Name: KL Public Shell
 * Description: Вход, регистрация и состояние подписки для новой публичной оболочки. Оплату по-прежнему проводит kl-robokassa-subscriptions.php.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

function kl_shell_client_ip(): string
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '0';
    return substr(preg_replace('/[^0-9a-fA-F:.]/', '', $ip) ?? '0', 0, 64);
}

function kl_shell_rate_key(string $bucket): string
{
    return 'klsh_' . $bucket . '_' . md5(kl_shell_client_ip());
}

function kl_shell_rate_blocked(string $bucket, int $limit = 12): bool
{
    return (int) get_transient(kl_shell_rate_key($bucket)) >= $limit;
}

function kl_shell_rate_hit(string $bucket): void
{
    $key = kl_shell_rate_key($bucket);
    $n = (int) get_transient($key);
    set_transient($key, $n + 1, 15 * MINUTE_IN_SECONDS);
}

function kl_shell_json(array $payload, int $status = 200): void
{
    nocache_headers();
    status_header($status);
    header('Content-Type: application/json; charset=utf-8');
    echo wp_json_encode($payload);
    exit;
}

function kl_shell_nonce_html(string $action, string $name): string
{
    return (string) wp_nonce_field($action, $name, true, false);
}

function kl_shell_safe_next(string $raw): string
{
    $raw = trim(wp_unslash($raw));
    if ($raw === '' || $raw[0] !== '/' || str_starts_with($raw, '//') || str_starts_with($raw, '/\\')) {
        return home_url('/account');
    }
    $path = (string) wp_parse_url($raw, PHP_URL_PATH);
    if ($path === '' || !str_starts_with($path, '/')) {
        return home_url('/account');
    }
    if (preg_match('#^/(wp-admin|wp-login|wp-json|xmlrpc)#', $path)) {
        return home_url('/account');
    }
    $query = wp_parse_url($raw, PHP_URL_QUERY);
    $target = home_url($path);
    if (is_string($query) && $query !== '') {
        $target .= '?' . $query;
    }
    return (string) wp_validate_redirect($target, home_url('/account'));
}

function kl_shell_boot(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        kl_shell_json(['ok' => false], 405);
    }
    kl_shell_json([
        'ok' => true,
        'nonce_html' => kl_shell_nonce_html('kl_shell', 'kl_shell_nonce'),
    ]);
}

function kl_shell_login_name(string $raw): string
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

function kl_shell_login(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        wp_safe_redirect(home_url('/login'));
        exit;
    }
    $back = home_url('/login?error=1');
    if (!isset($_POST['kl_shell_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['kl_shell_nonce'])), 'kl_shell')) {
        wp_safe_redirect(add_query_arg('error', 'nonce', home_url('/login')));
        exit;
    }
    if (kl_shell_rate_blocked('login', 10)) {
        wp_safe_redirect(add_query_arg('error', 'rate', home_url('/login')));
        exit;
    }
    $login = kl_shell_login_name((string) ($_POST['kl_login'] ?? ''));
    $password = isset($_POST['kl_password']) ? (string) wp_unslash($_POST['kl_password']) : '';
    if ($login === '' || $password === '' || strlen($password) > 200) {
        wp_safe_redirect($back);
        exit;
    }
    $user = wp_signon([
        'user_login' => $login,
        'user_password' => $password,
        'remember' => true,
    ], is_ssl());
    if ($user instanceof WP_Error) {
        kl_shell_rate_hit('login');
        wp_safe_redirect($back);
        exit;
    }
    $next = isset($_POST['next']) ? kl_shell_safe_next((string) $_POST['next']) : home_url('/account');
    wp_safe_redirect($next);
    exit;
}

function kl_shell_register(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        wp_safe_redirect(home_url('/register'));
        exit;
    }
    if (is_user_logged_in()) {
        wp_safe_redirect(home_url('/account'));
        exit;
    }
    $fail = static function (string $code): void {
        wp_safe_redirect(add_query_arg('error', $code, home_url('/register')));
        exit;
    };
    if (!isset($_POST['kl_shell_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['kl_shell_nonce'])), 'kl_shell')) {
        $fail('nonce');
    }
    if (!empty($_POST['company'])) {
        $fail('1');
    }
    if (kl_shell_rate_blocked('register', 8)) {
        $fail('rate');
    }
    kl_shell_rate_hit('register');
    if (empty($_POST['kl_shell_pdn'])) {
        $fail('consent');
    }
    $email = sanitize_email(wp_unslash((string) ($_POST['kl_email'] ?? '')));
    $name = sanitize_text_field(wp_unslash((string) ($_POST['kl_name'] ?? '')));
    $password = isset($_POST['kl_password']) ? (string) wp_unslash($_POST['kl_password']) : '';
    if (!is_email($email)) {
        $fail('email');
    }
    if (email_exists($email)) {
        $fail('exists');
    }
    if (strlen($name) < 2 || strlen($name) > 80 || strlen($password) < 8 || strlen($password) > 200) {
        $fail('fields');
    }
    $user_id = wp_insert_user([
        'user_login' => $email,
        'user_email' => $email,
        'user_pass' => $password,
        'display_name' => $name,
        'first_name' => $name,
        'role' => 'subscriber',
    ]);
    if ($user_id instanceof WP_Error || !$user_id) {
        $fail('1');
    }
    $user_id = (int) $user_id;
    update_user_meta($user_id, 'kl_email_verified', '0');
    update_user_meta($user_id, 'kl_shell_registered', (string) time());
    if (function_exists('kl_reg_issue_confirm_token') && function_exists('kl_reg_confirm_url')) {
        $token = (string) kl_reg_issue_confirm_token($user_id);
        if ($token !== '') {
            $url = kl_reg_confirm_url($token);
            wp_mail(
                $email,
                'Подтвердите почту — Кинолог LIFE',
                "Здравствуйте!\n\nАккаунт создан. Подтвердите почту по ссылке (3 дня):\n{$url}\n\nПароль — тот, который вы задали при регистрации.\n"
            );
        }
    }
    wp_set_current_user($user_id);
    wp_set_auth_cookie($user_id, true, is_ssl());
    wp_safe_redirect(home_url('/account?welcome=1'));
    exit;
}

function kl_shell_logout(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        wp_safe_redirect(home_url('/'));
        exit;
    }
    if (!isset($_POST['kl_shell_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['kl_shell_nonce'])), 'kl_shell')) {
        wp_safe_redirect(home_url('/account?error=nonce'));
        exit;
    }
    wp_logout();
    wp_safe_redirect(home_url('/'));
    exit;
}

function kl_shell_access_payload(int $uid): array
{
    $until = 0;
    $has = false;
    $recurring = false;
    $label = '';
    if ($uid > 0 && function_exists('kl_baza_access_bundle_for_uid')) {
        $bundle = kl_baza_access_bundle_for_uid($uid);
        $has = !empty($bundle['has_minimum_access']) || !empty($bundle['is_unlimited_access']) || !empty($bundle['is_staff_account']);
        $until = (int) ($bundle['access_until_unix'] ?? 0);
        $recurring = !empty($bundle['recurring_active']);
    } elseif ($uid > 0 && function_exists('kl_sub_articles_until_ts')) {
        $until = max(
            (int) kl_sub_articles_until_ts($uid),
            function_exists('kl_sub_video_until_ts') ? (int) kl_sub_video_until_ts($uid) : 0
        );
        $has = $until > time();
        $recurring = get_user_meta($uid, 'kl_rb_recurring_active', true) === '1';
    }
    if ($until > time()) {
        $label = wp_date('j F Y', $until);
    }
    $verified = $uid > 0 ? (string) get_user_meta($uid, 'kl_email_verified', true) : '';
    $email_verified = null;
    if ($verified === '1') {
        $email_verified = true;
    } elseif ($verified === '0') {
        $email_verified = false;
    }
    $sso = $has ? 'https://baza.kinologlife.online/login' : '';
    $user = $uid > 0 ? get_userdata($uid) : null;
    return [
        'logged_in' => $uid > 0,
        'name' => $user instanceof WP_User ? (string) $user->display_name : '',
        'email' => $user instanceof WP_User ? (string) $user->user_email : '',
        'has_access' => $has,
        'access_until_unix' => $until,
        'access_until_label' => $label,
        'recurring_active' => $recurring,
        'force_password' => $uid > 0 && get_user_meta($uid, 'kl_rb_force_pw', true) === '1',
        'email_verified' => $email_verified,
        'sso_url' => $sso,
    ];
}

function kl_shell_me(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        kl_shell_json(['ok' => false], 405);
    }
    $uid = is_user_logged_in() ? (int) get_current_user_id() : 0;
    kl_shell_json(array_merge(['ok' => true], kl_shell_access_payload($uid)));
}

function kl_shell_pay(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        kl_shell_json(['ok' => false], 405);
    }
    $uid = is_user_logged_in() ? (int) get_current_user_id() : 0;
    $user = $uid > 0 ? get_userdata($uid) : null;
    $price = defined('KL_SUB_PRICE_CLUB') ? (int) KL_SUB_PRICE_CLUB : 1990;
    if (function_exists('kl_rb_expected_club_amount')) {
        $price = (int) round(kl_rb_expected_club_amount());
    }
    $curator = defined('KL_SUB_PRICE_CURATOR') ? (int) KL_SUB_PRICE_CURATOR : 14990;
    kl_shell_json([
        'ok' => true,
        'logged_in' => $uid > 0,
        'email' => $user instanceof WP_User ? (string) $user->user_email : '',
        'name' => $user instanceof WP_User ? (string) $user->display_name : '',
        'price' => $price,
        'curator_price' => $curator,
        'configured' => function_exists('kl_rb_configured') ? (bool) kl_rb_configured() : false,
        'consent_required' => function_exists('kl_rb_recurring_consent_visible') ? (bool) kl_rb_recurring_consent_visible() : true,
        'consent_text' => function_exists('kl_rb_recurring_consent_text') ? kl_rb_recurring_consent_text() : '',
        'can_curator' => $uid > 0 && function_exists('kl_rb_can_checkout_tier') && kl_rb_can_checkout_tier('curator'),
        'offer_url' => function_exists('kl_rb_recurring_offer_url') ? kl_rb_recurring_offer_url() : home_url('/offer/'),
        'privacy_url' => function_exists('kl_rb_privacy_policy_url') ? kl_rb_privacy_policy_url() : home_url('/privacy-policy/'),
        'pdn_url' => function_exists('kl_rb_pdn_consent_url') ? kl_rb_pdn_consent_url() : home_url('/consent-pdn/'),
        'nonce_html' => kl_shell_nonce_html('kl_rb_start', 'kl_rb_nonce'),
    ]);
}

function kl_shell_dispatch(string $which): void
{
    if ($which === 'boot') {
        kl_shell_boot();
    } elseif ($which === 'login') {
        kl_shell_login();
    } elseif ($which === 'register') {
        kl_shell_register();
    } elseif ($which === 'logout') {
        kl_shell_logout();
    } elseif ($which === 'me') {
        kl_shell_me();
    } elseif ($which === 'pay') {
        kl_shell_pay();
    }
}

foreach (['boot', 'login', 'register', 'logout', 'me', 'pay'] as $kl_shell_action) {
    $callback = static function () use ($kl_shell_action): void {
        kl_shell_dispatch($kl_shell_action);
    };
    add_action('admin_post_kl_shell_' . $kl_shell_action, $callback);
    add_action('admin_post_nopriv_kl_shell_' . $kl_shell_action, $callback);
}

/**
 * Голый /join/ больше не показывает старую витрину.
 * Возврат Robokassa (?rb_paid, ?pt и служебные флаги) остаётся на WordPress.
 */
add_action('template_redirect', static function (): void {
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
        return;
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        return;
    }
    if (!function_exists('is_page') || !is_page('join')) {
        return;
    }
    foreach (['rb_paid', 'pt', 'rb_fail', 'welcome', 'rb_email_err', 'rb_pdn_err', 'rb_consent_err', 'rb_check_mail', 'rb_existing', 'rb_pw_err', 'att'] as $key) {
        if (!empty($_GET[$key])) {
            return;
        }
    }
    if (!empty($_COOKIE['kl_rb_claim'])) {
        return;
    }
    $args = [];
    if (!empty($_GET['from'])) {
        $args['from'] = sanitize_key((string) wp_unslash($_GET['from']));
    }
    wp_safe_redirect(add_query_arg($args, home_url('/tarif')), 302);
    exit;
}, 0);
