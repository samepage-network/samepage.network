-- Unit tests address the SamePage app by both ID 0 and code "SamePage".
SET SESSION sql_mode = CONCAT(@@sql_mode, ',NO_AUTO_VALUE_ON_ZERO');

INSERT INTO apps (id, code, name, live, workspace_label, origin_regex)
VALUES (0, 'SamePage', 'SamePage', 1, 'workspace', '.*');

INSERT INTO quotas (uuid, field, value)
VALUES (UUID(), 0, 100), (UUID(), 1, 3);
