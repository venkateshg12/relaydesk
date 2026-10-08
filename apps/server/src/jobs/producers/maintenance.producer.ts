import { JOB_NAMES } from "../../constants/queue.js";
import { maintenanceQueue } from "../queues/maintenance.queue.js";

export class MaintenanceProducer {
    static async scheduleRepeatableJobs() {
        // Repeatable sweep every 15 minutes
        await maintenanceQueue.add(
            JOB_NAMES.MAINTENANCE.SWEEP_EXPIRED,
            {},
            {
                jobId: "maintenance-sweep-expired",
                repeat: {
                    every: 15 * 60 * 1000
                }
            }
        );

        // Repeatable demo workspace deletion every 60 minutes
        await maintenanceQueue.add(
            JOB_NAMES.MAINTENANCE.DELETE_DEMO_WORKSPACES,
            {},
            {
                jobId: "maintenance-delete-demo-workspaces",
                repeat: {
                    every: 60 * 60 * 1000
                }
            }
        );
    }

    static async addSweepExpiredJob() {
        return await maintenanceQueue.add(
            JOB_NAMES.MAINTENANCE.SWEEP_EXPIRED,
            {},
            {
                jobId: `sweep-manual-${Date.now()}`
            }
        );
    }
}
