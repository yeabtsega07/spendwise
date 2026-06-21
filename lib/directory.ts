import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "./types";

/** Best display name we can derive for the signed-in user. */
export function nameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const meta = user.user_metadata || {};
  const fromMeta = (meta.name as string) || (meta.full_name as string);
  if (fromMeta) return fromMeta;
  return user.email ? user.email.split("@")[0] : "You";
}

/**
 * Make sure the current user has a row in the directory so other people can
 * find them by email. The signup trigger handles new accounts; this is a
 * safety net that also keeps the display name fresh.
 */
export async function ensureProfile(supabase: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return;
  const { error } = await supabase.from("profiles").upsert(
    { id: user.id, email: user.email, display_name: nameFromUser(user) },
    { onConflict: "id" }
  );
  if (error) console.warn("Could not sync profile:", error.message);
}

/** Search the directory by email or name. Returns up to 6 matches. */
export async function searchProfiles(
  supabase: SupabaseClient,
  query: string,
  excludeId?: string
): Promise<Profile[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const safe = term.replace(/[%,]/g, " ");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .or(`email.ilike.%${safe}%,display_name.ilike.%${safe}%`)
    .limit(6);
  if (error) {
    console.warn("User search failed:", error.message);
    return [];
  }
  return (data || [])
    .filter((r) => r.id !== excludeId)
    .map((r) => ({
      id: r.id as string,
      email: r.email as string,
      displayName: (r.display_name as string) || (r.email as string),
    }));
}
