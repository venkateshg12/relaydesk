// A Redis channel between processes: the worker (which deletes expired demo workspaces and has no sockets)
// publishes a workspace id here; every API instance disconnects that workspace's sockets.
export const WORKSPACE_DELETED_CHANNEL = "relaydesk:workspace-deleted";
