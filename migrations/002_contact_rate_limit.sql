ALTER TABLE contact_messages
ADD COLUMN source_ip_hash char(64);

CREATE INDEX contact_messages_rate_limit
ON contact_messages (source_ip_hash, created_at DESC)
WHERE source_ip_hash IS NOT NULL;
