import { createServerFn } from "@tanstack/react-start";

export type Testimonial = {
  id: string;
  author_name: string;
  author_city: string | null;
  content: string;
  rating: number;
  avatar_url: string | null;
  featured: boolean;
};

export const listTestimonials = createServerFn({ method: "GET" }).handler(
  async (): Promise<Testimonial[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("testimonials")
      .select("id, author_name, author_city, content, rating, avatar_url, featured")
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as Testimonial[];
  },
);
