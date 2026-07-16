ALTER TABLE aikart_users
    ADD COLUMN IF NOT EXISTS selected_token_id bigint;
