-- Account role. Everyone is 'user'; the site owner is 'owner'. The owner is set by hand
-- (UPDATE users SET role = 'owner' WHERE email = ...), never from the signup form.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'owner'));
