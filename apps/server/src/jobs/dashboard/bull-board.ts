import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "../queues/email.queue.js";
import { maintenanceQueue } from "../queues/maintenance.queue.js";

export function setupBullBoard() {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath("/admin/queues");

    createBullBoard({
        queues: [
            new BullMQAdapter(emailQueue),
            new BullMQAdapter(maintenanceQueue),
        ],
        serverAdapter,
    });

    return serverAdapter.getRouter();
}
