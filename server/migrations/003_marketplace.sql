ALTER TABLE aikart_works ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE aikart_works ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0;
ALTER TABLE aikart_works ADD COLUMN IF NOT EXISTS copy_count bigint NOT NULL DEFAULT 0;
ALTER TABLE aikart_works ADD COLUMN IF NOT EXISTS download_count bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS aikart_works_status_published_idx
    ON aikart_works(status, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS aikart_media_owner_retention_idx
    ON aikart_media(owner_id, retention, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS aikart_purchases_status_idx
    ON aikart_purchases(status, created_at DESC);
