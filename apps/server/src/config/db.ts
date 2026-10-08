import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamily } from "node:net";

// Node's Happy-Eyeballs dual-stack connect races IPv4 and IPv6 for every new pool connection.
// In environments with no real IPv6 route (WSL2, some containers) the IPv6 attempts silently
// eat the race and connections intermittently time out. Neon is reachable over IPv4, so pin to it.
setDefaultResultOrder("ipv4first");
setDefaultAutoSelectFamily(false);

export { db, pool, orm } from "../prisma/db.js";
