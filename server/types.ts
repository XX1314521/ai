export type AikartUserRow = {
    id: string;
    new_api_user_id: string;
    username: string;
    display_name: string;
    avatar_url: string;
    encrypted_api_key: string | null;
    api_key_hint: string;
    new_api_role: number;
    status: "active" | "banned";
    invite_code: string;
    invited_by_user_id: string | null;
    created_at: Date;
    updated_at: Date;
    last_login_at: Date;
};

export type BillingUserRow = {
    id: string;
    username: string;
    quota: string;
    role: number;
    status: number;
    group: string;
};

export type AuthenticatedUser = {
    id: string;
    newApiUserId: number;
    username: string;
    displayName: string;
    avatarUrl: string;
    role: "user" | "admin";
    status: "active" | "banned";
    inviteCode: string;
    invitedByUserId: string | null;
    apiKey: string;
    apiKeyHint: string;
    quota: number;
};

export type PublicUser = Omit<AuthenticatedUser, "apiKey" | "quota"> & {
    balance: number;
    inviteLink: string;
    retentionDays: number;
};
