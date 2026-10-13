-- Migration: 016_auth_sessions
-- Description: Autenticacao no servidor (spec 010, MySQL 8). Banco novo: nao altera senhas.
--   * users.last_login_at: ultimo login bem-sucedido (a troca obrigatoria de senha usa a coluna
--     first_login que ja existe).
--   * user_sessions: sessao por cookie com token opaco; so o hash (SHA-256) do token e guardado.
--     Expira por inatividade (idle_expires_at) e de forma absoluta (absolute_expires_at);
--     revoked_at registra logout/revogacao. Apagada em cascata com o usuario.
--   * auth_attempts: tentativas para limite de taxa (login, cadastro, troca de senha, pedido de
--     redefinicao). subject_hash e o SHA-256 de CPF/IP/id: o valor em claro nao e guardado.
--   * password_reset_requests: pedido de "esqueci a senha" e codigo de uso unico emitido por
--     admin/dev (so o hash do codigo e guardado). open_user_id (coluna gerada VIRTUAL) com UNIQUE
--     garante no maximo um pedido aberto/emitido por usuario.
-- Rollback: DROP TABLE `password_reset_requests`, `auth_attempts`, `user_sessions`;
--   ALTER TABLE `users` DROP COLUMN `last_login_at`;

ALTER TABLE `users`
  ADD COLUMN `last_login_at` DATETIME NULL DEFAULT NULL AFTER `theme_preference`;

CREATE TABLE `user_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `idle_expires_at` DATETIME NOT NULL,
  `absolute_expires_at` DATETIME NOT NULL,
  `revoked_at` DATETIME NULL DEFAULT NULL,
  `ip` VARCHAR(45) NULL DEFAULT NULL,
  `user_agent` VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_sessions_token_hash` (`token_hash`),
  KEY `idx_user_sessions_user` (`user_id`, `revoked_at`),
  KEY `idx_user_sessions_absolute` (`absolute_expires_at`),
  CONSTRAINT `user_sessions_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `auth_attempts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `kind` VARCHAR(32) NOT NULL,
  `subject_hash` CHAR(64) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_auth_attempts_lookup` (`kind`, `subject_hash`, `created_at`),
  KEY `idx_auth_attempts_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `password_reset_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `status` ENUM('open', 'issued', 'used', 'expired', 'cancelled') NOT NULL DEFAULT 'open',
  `code_hash` CHAR(64) NULL DEFAULT NULL,
  `issued_by` INT NULL DEFAULT NULL,
  `issued_at` DATETIME NULL DEFAULT NULL,
  `expires_at` DATETIME NULL DEFAULT NULL,
  `failed_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `requested_ip` VARCHAR(45) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` DATETIME NULL DEFAULT NULL,
  `open_user_id` INT GENERATED ALWAYS AS (IF(`status` IN ('open', 'issued'), `user_id`, NULL)) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_password_reset_open_user` (`open_user_id`),
  KEY `idx_password_reset_user` (`user_id`),
  KEY `idx_password_reset_status` (`status`, `created_at`),
  CONSTRAINT `password_reset_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `password_reset_issuer_fk` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
