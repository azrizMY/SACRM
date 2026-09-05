ALTER TABLE users ADD COLUMN public_token TEXT;
UPDATE users SET public_token = lower(hex(randomblob(16))) WHERE public_token IS NULL;
CREATE UNIQUE INDEX idx_users_public_token ON users(public_token);
