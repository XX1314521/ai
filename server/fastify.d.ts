import "@fastify/cookie";
import type { AuthenticatedUser } from "./types.js";

declare module "fastify" {
    interface FastifyRequest {
        aikartUser: AuthenticatedUser | null;
    }
}
