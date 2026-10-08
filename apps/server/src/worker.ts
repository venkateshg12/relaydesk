import "dotenv/config";
import { emailWorker } from "./jobs/workers/email.worker.js";
import { maintenanceWorker } from "./jobs/workers/maintenance.worker.js";
import { MaintenanceProducer } from "./jobs/producers/maintenance.producer.js";

/** Stops both queue workers from taking new jobs and waits for the ones in flight. */
export const closeWorkers = async () => {
    await Promise.all([
        emailWorker.close(),
        maintenanceWorker.close(),
    ]);
};

export async function startWorker() {
    await MaintenanceProducer.scheduleRepeatableJobs();
    console.log("🚀 Background Worker Process Initialized (Email & Maintenance Workers Active)");
}

/*
  This module is imported by the API (index.ts) so one process can serve requests and run jobs in dev,
  and is also started on its own via `pnpm worker`. Only the standalone process connects the database
  and owns the signal handlers: registering them here unconditionally meant that in the API process
  a SIGTERM exited as soon as the workers closed, killing in-flight HTTP requests — possibly
  mid-transaction. When imported, index.ts drives shutdown and calls closeWorkers() itself.
 */
const isStandalone = process.argv[1]?.endsWith("worker.ts") || process.argv[1]?.endsWith("worker.js");

if (isStandalone) {
    startWorker().catch((err) => {
        console.error("Failed to start worker process:", err);
        process.exit(1);
    });

    const shutdown = async (signal: string) => {
        console.log(`\nReceived ${signal}. Closing background workers gracefully...`);
        await closeWorkers();
        console.log("Background worker shutdown complete.");
        process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}
