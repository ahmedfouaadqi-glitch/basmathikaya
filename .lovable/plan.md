# Stage 5 — Family Library UI

Wire up the existing `family_members` table (already has RLS + 4 policies) to a real user-facing UI so parents can save children/family members once and reuse them across orders.

## Scope

- New authenticated route `/_authenticated/family` — list + CRUD for family members.
- New reusable `FamilyPicker` component used inside the story creation flow to prefill character info from a saved family member (no schema change, no order logic change).
- Nav entry in the authenticated shell.

Non-goals: photo DNA reuse (that's Stage 3's `reuse_character_sheet` flag, separate), sharing family across accounts, roles/permissions.

## Files

**New**
- `src/lib/family.functions.ts` — server fns (all `.middleware([requireSupabaseAuth])`, RLS does the scoping):
  - `listFamilyMembers()` → `select *`
  - `createFamilyMember(input)` → `insert`
  - `updateFamilyMember({ id, patch })` → `update`
  - `deleteFamilyMember({ id })` → `delete`
  - Zod validation on all inputs (name, age, gender, relation, notes, photo_path optional).
- `src/routes/_authenticated/family.tsx` — list page (cards grid), "Add member" button opens dialog, edit/delete per card. Uses `useSuspenseQuery` + `queryOptions` pattern; loader calls `ensureQueryData`.
- `src/components/family/FamilyMemberForm.tsx` — shared form (create + edit), react-hook-form + zod.
- `src/components/family/FamilyMemberCard.tsx` — display card with edit/delete actions.
- `src/components/family/FamilyPicker.tsx` — dropdown/list used in story creation; `onSelect(member)` callback fills character fields.

**Modified**
- Authenticated shell nav (wherever the current sidebar/header lives, e.g. `src/components/layout/*` or `_authenticated/route.tsx`) — add "عائلتي" link to `/family`.
- Story creation character step (existing component in the create flow) — add optional `<FamilyPicker>` above the character form; selecting a member prefills fields. No behavior change if user ignores it.

## Principles

- Backward compatible: no changes to `orders`, `order_characters`, or any server fn signatures. FamilyPicker is purely additive UI.
- All server fns authenticated; RLS enforces user_id scoping (already in place).
- Photo upload deferred — form accepts existing `photo_path` if present, but new-photo upload UI comes with Stage 3 character DNA reuse.
- Arabic UI copy, RTL-friendly.

## Verification

- `bunx tsgo --noEmit`
- Manual: create → edit → delete a member; open create-order flow and confirm picker prefill works and ignoring it leaves the flow unchanged.

Confirm to proceed, or say which piece to drop/change.
