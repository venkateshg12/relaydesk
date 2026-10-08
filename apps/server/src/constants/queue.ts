export const QUEUE_NAMES = {
    EMAIL: "email-queue",
    MAINTENANCE: "maintenance-queue"
} as const;

export const JOB_NAMES = {
    EMAIL: {
        SEND_INVITATION: "send_invitation",
        SEND_OFFLINE_REPLY: "send_offline_reply"
    },
    MAINTENANCE: {
        SWEEP_EXPIRED: "sweep_expired",
        DELETE_DEMO_WORKSPACES: "delete_demo_workspaces"
    }
} as const;
