export type PlatformUser = {
    id: string;
    newApiUserId: number;
    username: string;
    displayName: string;
    avatarUrl: string;
    role: "user" | "admin";
    status: "active" | "banned";
    inviteCode: string;
    invitedByUserId: string | null;
    apiKeyHint: string;
    balance: number;
    inviteLink: string;
    retentionDays: number;
};

export type ShowcaseWork = {
    id: string;
    title: string;
    description: string;
    accessType: "private" | "free" | "paid";
    price: number;
    status: "saved" | "published" | "blocked" | "deleted";
    metadata: Record<string, unknown>;
    owner: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string;
    };
    media: {
        id: string;
        filename: string;
        mimeType: string;
        width: number | null;
        height: number | null;
        url: string;
        downloadUrl: string;
    };
    isOwner: boolean;
    purchased: boolean;
    canAccessPrompt: boolean;
    stats: { views: number; copies: number; downloads: number };
    createdAt: string;
    updatedAt: string;
    publishedAt: string | null;
};
