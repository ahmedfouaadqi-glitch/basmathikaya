# Stage 7 — Admin Operational Pages

Add the 9 missing operational admin pages that expose Stages 3–6 infra (feature flags, jobs, caches, AI health, kill switches) and clean up existing gaps (redownloads, phone bans, audit). All read-first with narrow write actions; every write goes through admin-authed server fns using the existing `adminCheck` middleware pattern.

## Pages (all under `/admin/*`, wired into `admin.tsx` nav)

1. **`/admin/flags`** — Feature Flags (`feature_flags` table)
   - Toggle each flag on/off, adjust `rollout_percentage`.
   - Wire the 6 Stage-3 flags visibly.
2. **`/admin/jobs`** — Background Jobs (`background_jobs` table)
   - Filter by status/job_type, retry failed, cancel pending.
   - Show pg_cron last run status from `cron.job_run_details`.
3. **`/admin/ai-models`** — AI Models (`ai_models_config` + `ai_model_health` + `ai_model_events`)
   - List models with enabled toggle, priority, last 24h success rate.
   - Manual "test model" button.
4. **`/admin/emergency`** — Emergency Controls (`emergency_controls`)
   - Big kill switches: pause AI, pause orders, pause new registrations. Reason field required.
5. **`/admin/audit`** — Audit Log viewer (`audit_log`)
   - Filter by actor/action/date range. Read-only. Paginated (50/page).
6. **`/admin/phone-bans`** — Phone Bans (`phone_bans`)
   - Add/remove bans with reason. Search.
7. **`/admin/redownloads`** — Redownload Requests (`redownload_requests`)
   - Pending queue: approve (mark paid), reject with reason. Notifies user.
8. **`/admin/caches`** — Cache Stats (`prompt_cache` + `character_analysis_cache`)
   - Hit counts, total cost saved (sum of `cost_usd`), row count, purge-expired button.
9. **`/admin/share-events`** — Share Analytics (`share_events`)
   - Aggregated share counts by platform + top shared orders (last 30 days).

## Files

**New server fns** (all `.handler`s call `requireAdmin`):
- `src/lib/admin/flags.functions.ts` — list, toggle, update rollout.
- `src/lib/admin/jobs.functions.ts` — list, retry, cancel; `cronRuns()` reads `cron.job_run_details` via `supabaseAdmin.rpc` or plain query.
- `src/lib/admin/ai-models.functions.ts` — list config+health, toggle enabled, update priority.
- `src/lib/admin/emergency.functions.ts` — list, set control (with reason + `admin_id`).
- `src/lib/admin/audit.functions.ts` — paginated list + filter.
- `src/lib/admin/phone-bans.functions.ts` — list, add, remove.
- `src/lib/admin/redownloads.functions.ts` — list pending, approve, reject.
- `src/lib/admin/caches.functions.ts` — stats + purge expired.
- `src/lib/admin/share-events.functions.ts` — aggregations.

**New routes**: 9 route files above, each following existing admin route pattern (`beforeLoad: adminCheck`, single-file page with table/toggles).

**Modified**:
- `src/routes/admin.tsx` — add 9 nav links, group into two rows if crowded.

## Principles

- Read-first: every page loads and displays data before offering any write.
- No destructive default: destructive actions (purge cache, ban phone, kill switch) require confirmation prompt.
- All writes append an `audit_log` row.
- No schema changes; all tables already exist.
- Follow existing admin visual patterns (border cards, tables, badges).

## Verification

- `bunx tsgo --noEmit`
- Load each new page; verify data renders and one write action per page works end-to-end.

## Notes

This is a large stage (~18 new files, ~2500 LOC). If you want a subset first, tell me which pages matter most and I'll cut the rest. Otherwise I'll ship all 9 in this session in the order listed above.

Confirm to proceed with all 9, or reply with a subset (e.g. "1,2,4,7 only").
