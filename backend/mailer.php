<?php
declare(strict_types=1);

/**
 * Sends the "new message" notification to the site owner.
 * Drivers (config 'mail.driver'):
 *   smtp  - PHPMailer over SMTP (Gmail app password, host mail account, Brevo SMTP...)
 *   brevo - Brevo HTTPS API (use this when the host blocks outgoing SMTP ports)
 *   mail  - PHP's built-in mail() (least reliable)
 * The visitor's address is set as Reply-To, so pressing Reply answers them directly.
 * Name/email arrive already validated (no CR/LF), so header injection is not possible.
 *
 * @return array{0: bool, 1: string} [sent, error detail for the server log]
 */
function send_notification(array $cfg, string $name, string $email, string $message): array
{
    $m = $cfg['mail'] ?? [];
    if (empty($m['to']) || empty($m['from'])) return [false, 'mail.to / mail.from are not configured'];

    $subject = 'New portfolio message from ' . $name;
    $body = "You have a new message from your portfolio contact form.\n\n"
        . "Name:  $name\nEmail: $email\n\n----- Message -----\n$message\n-------------------\n\n"
        . "Just press Reply to answer $name directly.\n";

    try {
        switch ($m['driver'] ?? 'mail') {
            case 'smtp':  return mail_smtp($m, $subject, $body, $name, $email);
            case 'brevo': return mail_brevo($m, $subject, $body, $name, $email);
            default:      return mail_native($m, $subject, $body, $email);
        }
    } catch (Throwable $e) {
        return [false, get_class($e) . ': ' . $e->getMessage()];
    }
}

function mail_smtp(array $m, string $subject, string $body, string $name, string $email): array
{
    $password = trim((string) ($m['password'] ?? ''));
    if ($password === '' || $password === 'YOUR_16_CHAR_APP_PASSWORD') {
        return [false, 'Set mail.password in backend/config.php to your Gmail App Password'];
    }

    require_once __DIR__ . '/vendor/phpmailer/Exception.php';
    require_once __DIR__ . '/vendor/phpmailer/PHPMailer.php';
    require_once __DIR__ . '/vendor/phpmailer/SMTP.php';

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = (string) ($m['host'] ?? '');
    $mail->Port = (int) ($m['port'] ?? 587);
    $mail->SMTPAuth = true;
    $mail->Username = (string) ($m['username'] ?? '');
    $mail->Password = $password;
    $mail->SMTPSecure = (($m['secure'] ?? 'tls') === 'ssl')
        ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Timeout = 10;
    $mail->CharSet = 'UTF-8';
    $mail->setFrom((string) $m['from'], (string) ($m['from_name'] ?? 'Portfolio Contact Form'));
    $mail->addAddress((string) $m['to']);
    $mail->addReplyTo($email, $name);
    $mail->Subject = $subject;
    $mail->Body = $body;
    $mail->send();                       // throws PHPMailer\PHPMailer\Exception on failure
    return [true, ''];
}

function mail_brevo(array $m, string $subject, string $body, string $name, string $email): array
{
    if (empty($m['api_key'])) return [false, 'mail.api_key is empty'];
    $payload = json_encode([
        'sender'      => ['name' => (string) ($m['from_name'] ?? 'Portfolio Contact Form'), 'email' => (string) $m['from']],
        'to'          => [['email' => (string) $m['to']]],
        'replyTo'     => ['email' => $email, 'name' => $name],
        'subject'     => $subject,
        'textContent' => $body,
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => ['accept: application/json', 'content-type: application/json', 'api-key: ' . $m['api_key']],
    ]);
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($res === false) return [false, 'curl error: ' . $err];
    return ($code >= 200 && $code < 300) ? [true, ''] : [false, "Brevo HTTP $code: " . substr((string) $res, 0, 300)];
}

function mail_native(array $m, string $subject, string $body, string $email): array
{
    $headers = implode("\r\n", [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: Portfolio <' . $m['from'] . '>',
        'Reply-To: ' . $email,
    ]);
    $ok = (bool) @mail((string) $m['to'], mb_encode_mimeheader($subject, 'UTF-8', 'B'), $body, $headers);
    return $ok ? [true, ''] : [false, 'mail() returned false (the host may have it disabled)'];
}
