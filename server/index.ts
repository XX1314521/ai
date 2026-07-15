import { buildApp } from "./app.js";
import { closeDatabases, migrateDatabases } from "./db.js";
import { config } from "./config.js";
import { startMaintenanceJobs } from "./maintenance.js";
import { ensureMediaBucket } from "./storage.js";

async function main() {
    await migrateDatabases();
    await ensureMediaBucket();
    const app = await buildApp();
    const stopMaintenance = startMaintenanceJobs(config.cleanupIntervalMinutes, app.log);

    const shutdown = async (signal: string) => {
        app.log.info({ signal }, "Shutting down AikArt API");
        stopMaintenance();
        await app.close();
        await closeDatabases();
        process.exit(0);
    };
    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));

    await app.listen({ host: config.host, port: config.port });
    app.log.info({ host: config.host, port: config.port }, "AikArt API is ready");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
