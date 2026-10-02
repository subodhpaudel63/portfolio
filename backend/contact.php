<?php
declare(strict_types=1);

/**
 * Secure contact-form endpoint.
 *   GET  ?action=token -> {"ok":true,"token":"..."}   signed, stateless CSRF token
 *   POST (JSON body)   -> validates, stores (PDO prepared statements) and emails the message
 *
 * Defences: origin allow-list + CORS, signed CSRF token, JSON-only requests (forces a CORS
 * preflight), strict validation, honeypot, per-IP rate limit, prepared statements, JSON-only
 * output (nothing is ever rendered as HTML), generic errors (details go to the server log).
 * Requires PHP 7.4+ with pdo_mysql and mbstring.
 */

ini_set('display_errors', '0');
ini_set('log_errors', '1');
mb_internal_encoding('UTF-8');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

function respond(int $status, array $body = [], array $extra = []): void
{
    http_response_code($status);
    foreach ($extra as $h) header($h);
    if ($status !== 204) echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(int $status, string $code, string $message, array $extra = []): void
{
    respond($status, ['ok' => false, 'code' => $code, 'message' => $message], $extra);
}
function respond_and_continue(array $body): void
{
    $json = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    http_response_code(200);
    header('Content-Length: ' . strlen($json));
    header('Connection: close');
    echo $json;
    ignore_user_abort(true);

    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
        return;
    }
    while (ob_get_level() > 0) ob_end_flush();
    flush();
}

set_error_handler(function ($no, $str, $file, $line) {
    if (!(error_reporting() & $no)) return false; // respect @-suppression
    throw new ErrorException($str, 0, $no, $file, $line);
});
set_exception_handler(function (Throwable $e) {
    error_log('[contact] ' . get_class($e) . ': ' . $e->getMessage());
    fail(500, 'server_error', 'Something went wrong on my side. Please try again later.');
});

/* ---------- helpers ---------- */

/** Strip control/bidi-override characters and normalise whitespace. Output escaping still happens where the text is displayed. */
function clean(string $v, bool $multiline = false): string
{
    if (!preg_match('//u', $v)) return '';                                   // invalid UTF-8
    $v = str_replace(["\r\n", "\r"], "\n", $v);
    $v = preg_replace('/[\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $v) ?? '';
    if ($multiline) {
        $v = preg_replace('/[^\P{Cc}\n\t]/u', '', $v) ?? '';                 // keep \n and \t only
        $v = preg_replace("/\n{3,}/", "\n\n", $v) ?? '';
        return trim($v);
    }
    return trim(preg_replace('/[\p{Cc}\s]+/u', ' ', $v) ?? '');
}
function sign(string $payload, string $secret): string
{
    return hash_hmac('sha256', $payload, $secret);
}
function makeToken(string $secret): string
{
    $p = time() . '.' . bin2hex(random_bytes(8));
    return $p . '.' . sign($p, $secret);
}
/** @return string '' when valid, otherwise an error code */
function checkToken(string $t, string $secret, int $ttl): string
{
    $parts = explode('.', $t);
    if (strlen($t) > 200 || count($parts) !== 3 || !ctype_digit($parts[0])) return 'bad_token';
    if (!hash_equals(sign($parts[0] . '.' . $parts[1], $secret), $parts[2])) return 'bad_token';
    return (time() - (int) $parts[0] > $ttl) ? 'expired_token' : '';
}
require_once __DIR__ . '/mailer.php';

/* ---------- config ---------- */

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) throw new RuntimeException('config.php is missing');
$cfg = require $configFile;
if (strlen((string) ($cfg['secret'] ?? '')) < 32) throw new RuntimeException('config secret must be at least 32 characters');

/* ---------- origin check + CORS ---------- */

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === '' && !empty($_SERVER['HTTP_REFERER'])) {           // browsers may omit Origin on same-origin GETs
    $r = parse_url((string) $_SERVER['HTTP_REFERER']);
    if (!empty($r['scheme']) && !empty($r['host'])) {
        $origin = $r['scheme'] . '://' . $r['host'] . (isset($r['port']) ? ':' . $r['port'] : '');
    }
}
$originOk = $origin !== '' && in_array($origin, $cfg['allowed_origins'], true);
if ($origin !== '' && !$originOk) fail(403, 'forbidden_origin', 'This origin is not allowed.');
if ($originOk) {
    header('Access-Control-Allow-Origin: ' . $origin);              // exact match from the allow-list, never reflected blindly
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Access-Control-Max-Age: 600');
}
if ($method === 'OPTIONS') respond(204);

/* ---------- GET: issue a CSRF token ---------- */

if ($method === 'GET') {
    if (($_GET['action'] ?? '') !== 'token') fail(404, 'not_found', 'Not found.');
    respond(200, ['ok' => true, 'token' => makeToken($cfg['secret'])]);
}
if ($method !== 'POST') fail(405, 'method_not_allowed', 'Method not allowed.', ['Allow: GET, POST, OPTIONS']);

/* ---------- POST: submit the form ---------- */

if (!$originOk) fail(403, 'forbidden_origin', 'This origin is not allowed.');
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) fail(415, 'unsupported_media', 'Send the form as JSON.');

$tokenError = checkToken((string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''), $cfg['secret'], (int) ($cfg['token_ttl'] ?? 7200));
if ($tokenError !== '') fail(403, $tokenError, 'Your session expired. Please try again.');

$raw = (string) file_get_contents('php://input', false, null, 0, 10241);
if (strlen($raw) > 10240) fail(413, 'too_large', 'Request is too large.');
$data = json_decode($raw, true, 4);
if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) fail(400, 'bad_json', 'Invalid request.');

$str = function (string $k) use ($data): string {
    return (isset($data[$k]) && is_string($data[$k])) ? $data[$k] : '';
};

// Honeypot: real visitors never see or fill this field. Pretend success so bots learn nothing.
if (trim($str('website')) !== '') respond(200, ['ok' => true, 'message' => 'Thanks! Your message has been sent.']);

$name = clean($str('name'));
$email = str_replace(' ', '', clean($str('email')));
$message = clean($str('message'), true);

$errors = [];
$n = mb_strlen($name);
if ($n < 2 || $n > 80) $errors['name'] = 'Please enter your name (2–80 characters).';
elseif (!preg_match('/^[\p{L}\p{M}][\p{L}\p{M}\s.\'’-]*$/u', $name)) $errors['name'] = 'Names can only contain letters, spaces, . \' and -.';

if ($email === '' || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Please enter a valid email address.';

$m = mb_strlen($message);
if ($m < 10 || $m > 3000) $errors['message'] = 'Please write a message (10–3000 characters).';

if ($errors) respond(422, ['ok' => false, 'code' => 'validation', 'message' => 'Please fix the highlighted fields.', 'errors' => $errors]);

/* ---------- rate limit + store (prepared statements only) ---------- */

$db = $cfg['db'];
$pdo = new PDO(
    'mysql:host=' . $db['host'] . ';dbname=' . $db['name'] . ';charset=utf8mb4',
    $db['user'],
    $db['pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

$ipHeader = $cfg['ip_header'] ?? null;                                 // e.g. 'HTTP_CF_CONNECTING_IP' behind Cloudflare
$ip = ($ipHeader && !empty($_SERVER[$ipHeader])) ? (string) $_SERVER[$ipHeader] : (string) ($_SERVER['REMOTE_ADDR'] ?? '');
if (!filter_var($ip, FILTER_VALIDATE_IP)) $ip = '0.0.0.0';
$ipHash = hash_hmac('sha256', $ip, $cfg['secret']);                    // raw IPs are never stored

$limit = $cfg['rate_limit'] ?? ['max' => 5, 'window' => 3600];
$q = $pdo->prepare('SELECT COUNT(*) FROM contact_messages WHERE ip_hash = :ip AND created_at > (NOW() - INTERVAL :w SECOND)');
$q->bindValue(':ip', $ipHash);
$q->bindValue(':w', (int) $limit['window'], PDO::PARAM_INT);
$q->execute();
if ((int) $q->fetchColumn() >= (int) $limit['max']) {
    fail(429, 'rate_limited', 'Too many messages. Please try again later.', ['Retry-After: ' . (int) $limit['window']]);
}

$ins = $pdo->prepare('INSERT INTO contact_messages (name, email, message, ip_hash, user_agent) VALUES (:n, :e, :m, :ip, :ua)');
$ins->execute([
    ':n' => $name,
    ':e' => $email,
    ':m' => $message,
    ':ip' => $ipHash,
    ':ua' => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
]);

// Acknowledge after saving; don't make the visitor wait for the SMTP connection.
$id = (int) $pdo->lastInsertId();
respond_and_continue([
    'ok' => true,
    'message' => 'Thanks! Your message was received. I will get back to you soon.',
]);

// The email result is logged and stored after the browser has received its response.
try {
    [$sent, $why] = send_notification($cfg, $name, $email, $message);
    if ($sent) {
        $pdo->prepare('UPDATE contact_messages SET emailed = 1 WHERE id = :id')->execute([':id' => $id]);
    } else {
        error_log("[contact] message #$id saved but the notification email failed: $why");
    }
} catch (Throwable $e) {
    error_log('[contact] post-save error: ' . $e->getMessage());
}
