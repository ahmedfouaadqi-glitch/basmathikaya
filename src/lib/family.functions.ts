import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RoleEnum = z.enum(["protagonist", "friend", "family", "pet", "other"]);

const CreateInput = z.object({
  display_name: z.string().trim().min(1).max(80),
  nickname: z.string().trim().max(80).optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),
  gender: z.string().trim().max(20).optional().nullable(),
  role: RoleEnum.default("family"),
  is_favorite: z.boolean().optional(),
});

const UpdateInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    display_name: z.string().trim().min(1).max(80).optional(),
    nickname: z.string().trim().max(80).nullable().optional(),
    age: z.number().int().min(0).max(120).nullable().optional(),
    gender: z.string().trim().max(20).nullable().optional(),
    role: RoleEnum.optional(),
    is_favorite: z.boolean().optional(),
    is_archived: z.boolean().optional(),
  }),
});

const IdInput = z.object({ id: z.string().uuid() });

export type FamilyMember = {
  id: string;
  display_name: string;
  nickname: string | null;
  age: number | null;
  gender: string | null;
  role: string;
  is_favorite: boolean;
  is_archived: boolean;
  times_used: number;
  last_used_at: string | null;
  source_photo_path: string | null;
  character_sheet_url: string | null;
  created_at: string;
  updated_at: string;
};

async function getUserId(): Promise<string> {
  const { requireUserSession } = await import("./user-session.server");
  const s = await requireUserSession();
  return s.data.userId!;
}

export const listFamilyMembers = createServerFn({ method: "GET" }).handler(
  async (): Promise<FamilyMember[]> => {
    const userId = await getUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("family_members")
      .select(
        "id, display_name, nickname, age, gender, role, is_favorite, is_archived, times_used, last_used_at, source_photo_path, character_sheet_url, created_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("is_archived", false)
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as FamilyMember[];
  },
);

export const createFamilyMember = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data }): Promise<FamilyMember> => {
    const userId = await getUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("family_members")
      .insert({ ...data, user_id: userId })
      .select(
        "id, display_name, nickname, age, gender, role, is_favorite, is_archived, times_used, last_used_at, source_photo_path, character_sheet_url, created_at, updated_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return row as FamilyMember;
  });

export const updateFamilyMember = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data }): Promise<FamilyMember> => {
    const userId = await getUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("family_members")
      .update(data.patch)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select(
        "id, display_name, nickname, age, gender, role, is_favorite, is_archived, times_used, last_used_at, source_photo_path, character_sheet_url, created_at, updated_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return row as FamilyMember;
  });

export const deleteFamilyMember = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await getUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("family_members")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
