CREATE TABLE IF NOT EXISTS contact_messages (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(80)  NOT NULL,
  email      VARCHAR(254) NOT NULL,
  message    TEXT         NOT NULL,
  ip_hash    CHAR(64)     NOT NULL,
  user_agent VARCHAR(255) NULL,
  emailed    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip_time (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Db table potflio lai