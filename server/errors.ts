export class ApiError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
        public readonly code = "request_error",
    ) {
        super(message);
    }
}

export function asErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Unknown error";
}
