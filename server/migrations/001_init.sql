CREATE TABLE IF NOT EXISTS aikart_users (
    id uuid PRIMARY KEY,
    new_api_user_id bigint NOT NULL UNIQUE,
    username text NOT NULL,
    display_name text NOT NULL DEFAULT '',
    avatar_url text NOT NULL DEFAULT '',
    encrypted_api_key text,
    api_key_hint text NOT NULL DEFAULT '',
    new_api_role integer NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
    invite_code text NOT NULL UNIQUE,
    invited_by_user_id uuid REFERENCES aikart_users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aikart_sessions (
    id uuid PRIMARY KEY,
    token_hash text NOT NULL UNIQUE,
    user_id uuid NOT NULL REFERENCES aikart_users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aikart_sessions_user_id_idx ON aikart_sessions(user_id);
CREATE INDEX IF NOT EXISTS aikart_sessions_expires_at_idx ON aikart_sessions(expires_at);

CREATE TABLE IF NOT EXISTS aikart_media (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES aikart_users(id) ON DELETE CASCADE,
    object_key text NOT NULL UNIQUE,
    filename text NOT NULL,
    mime_type text NOT NULL,
    bytes bigint NOT NULL CHECK (bytes >= 0),
    width integer,
    height integer,
    source text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'generated')),
    retention text NOT NULL DEFAULT 'permanent' CHECK (retention IN ('draft', 'saved', 'published', 'permanent')),
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS aikart_media_owner_id_idx ON aikart_media(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS aikart_media_expiry_idx ON aikart_media(expires_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS aikart_works (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES aikart_users(id) ON DELETE CASCADE,
    media_id uuid NOT NULL REFERENCES aikart_media(id) ON DELETE RESTRICT,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    prompt_ciphertext text NOT NULL,
    access_type text NOT NULL CHECK (access_type IN ('private', 'free', 'paid')),
    price_quota bigint NOT NULL DEFAULT 0 CHECK (price_quota >= 0),
    status text NOT NULL DEFAULT 'published' CHECK (status IN ('saved', 'published', 'blocked', 'deleted')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz
);
CREATE INDEX IF NOT EXISTS aikart_works_feed_idx ON aikart_works(access_type, published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS aikart_works_owner_idx ON aikart_works(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS aikart_purchases (
    id uuid PRIMARY KEY,
    work_id uuid NOT NULL REFERENCES aikart_works(id) ON DELETE RESTRICT,
    buyer_id uuid NOT NULL REFERENCES aikart_users(id) ON DELETE RESTRICT,
    seller_id uuid NOT NULL REFERENCES aikart_users(id) ON DELETE RESTRICT,
    inviter_id uuid REFERENCES aikart_users(id) ON DELETE SET NULL,
    price_quota bigint NOT NULL,
    platform_fee_quota bigint NOT NULL,
    invite_commission_quota bigint NOT NULL,
    seller_income_quota bigint NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    UNIQUE (buyer_id, work_id)
);
CREATE INDEX IF NOT EXISTS aikart_purchases_seller_idx ON aikart_purchases(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS aikart_purchases_inviter_idx ON aikart_purchases(inviter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS aikart_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO aikart_settings (key, value) VALUES
    ('platform_fee_bps', '1000'::jsonb),
    ('invite_commission_bps', '3000'::jsonb),
    ('min_price_display', '0.1'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS aikart_admin_actions (
    id uuid PRIMARY KEY,
    admin_user_id uuid NOT NULL REFERENCES aikart_users(id) ON DELETE RESTRICT,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
