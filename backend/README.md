# Contact form backend (PHP)

GitHub Pages cannot run PHP, so upload **this folder only** to a PHP host (e.g. your merobhoj.xo.je hosting).

1. In phpMyAdmin, create a database and run `potflio.sql` (table already exists? use the ALTER line at the bottom of that file).
2. Copy `config.example.php` to `config.php` and fill it in (secret, DB, allowed origins, **mail**).
3. Upload `backend/` (with `config.php` and the `vendor/` folder) to the host, e.g. `https://your-host.com/api/`.
4. Open `https://your-host.com/api/test-mail.php?key=YOUR_TEST_KEY`. It must say **SENT OK** and a test email must reach your inbox. If it says FAILED, the message tells you why. Then delete `test-mail.php`.
5. Set `CONTACT_API` in `js/data.js` to the endpoint URL. For a same-origin PHP host, use `backend/contact.php`; for a separate backend, use its full URL, e.g. `https://your-host.com/api/contact.php`.
6. Every message is saved in `contact_messages` before the form gets its response. Email is sent afterward (`emailed = 1` means the notification went out); check PHP's error log if it remains `0`. **Press Reply in your mail app to answer the visitor** (their address is the Reply-To).

## Choosing the email driver (`mail.driver` in config.php)
- **smtp + Gmail (easiest if your host allows SMTP):** Google Account -> Security -> turn on 2-Step Verification -> App passwords -> create one -> paste the 16 characters as `password` (no spaces). Keep `from` equal to `username`.
- **brevo (use this if test-mail says "connection timed out" / "could not connect"):** many free hosts block outgoing SMTP ports, but HTTPS works. Create a free Brevo account, add and verify your sender email (Senders & IP), create an API key (SMTP & API), then set `driver` to `brevo`, `api_key`, and `from` to the verified sender.
- **mail:** PHP's built-in `mail()`. Often disabled or sent to spam on shared hosts; use only as a last resort.
If notifications land in spam, mark one as "Not spam" once.
The local `config.php` must contain a real Gmail App Password in `mail.password`; the example placeholder will not send mail. Use `test-mail.php` after configuring it. The endpoint acknowledges a saved message before attempting email, so slow SMTP does not make the visitor wait.

Never commit `config.php` (it is in `.gitignore`). `_config.yml` keeps `backend/` out of the published GitHub Pages site.

## How the protections work
- **SQL injection:** PDO with native prepared statements; no user input is ever concatenated into SQL.
- **XSS:** the endpoint only returns JSON and sends plain-text email. The frontend renders every server message with `textContent`. Input is stripped of control/bidi characters; escape on output wherever you display it.
- **CSRF:** a signed, expiring token (HMAC) is fetched via CORS and must come back in an `X-CSRF-Token` header. Only allow-listed origins can read it or POST. Requests must be `application/json`, which forces a CORS preflight that other sites fail. No cookies are used, so it works cross-site.
- **Abuse:** honeypot field, per-IP rate limit (IPs stored only as keyed hashes), 10 KB body cap.
