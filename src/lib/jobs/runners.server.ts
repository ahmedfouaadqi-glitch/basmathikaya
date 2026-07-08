// Central registration point for background job runners.
// Import this file from the cron tick handler; runners will be added
// as later stages implement them (share cards, PDF, notifications, backup).
import { registerJob } from "./queue.server";

// Placeholder no-op runners so unrecognized kinds fail gracefully during rollout.
// Real runners register themselves in later stages by importing this module first.
registerJob("cleanup_old_drafts", async () => ({ skipped: true, note: "not implemented yet" }));
registerJob("send_notification", async (payload) => ({ ok: true, payload }));
registerJob("generate_pdf", async () => ({ skipped: true, note: "not implemented yet" }));
registerJob("generate_share_cards", async () => ({ skipped: true, note: "not implemented yet" }));
registerJob("daily_backup_snapshot", async () => ({ skipped: true, note: "not implemented yet" }));

export {};
