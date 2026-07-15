CREATE TABLE IF NOT EXISTS aikart_balance_settlements (
    id uuid PRIMARY KEY,
    purchase_id uuid NOT NULL UNIQUE,
    buyer_new_api_user_id bigint NOT NULL,
    seller_new_api_user_id bigint NOT NULL,
    inviter_new_api_user_id bigint,
    admin_new_api_user_id bigint NOT NULL,
    price_quota bigint NOT NULL,
    seller_income_quota bigint NOT NULL,
    platform_income_quota bigint NOT NULL,
    invite_commission_quota bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
