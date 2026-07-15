CREATE TABLE IF NOT EXISTS aikart_library_items (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES aikart_users(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('text', 'image', 'video')),
    title text NOT NULL,
    media_id uuid REFERENCES aikart_media(id) ON DELETE SET NULL,
    content_ciphertext text,
    tags jsonb NOT NULL DEFAULT '[]'::jsonb,
    note text NOT NULL DEFAULT '',
    source text NOT NULL DEFAULT '',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS aikart_library_owner_idx
    ON aikart_library_items(owner_id, created_at DESC)
    WHERE deleted_at IS NULL;
