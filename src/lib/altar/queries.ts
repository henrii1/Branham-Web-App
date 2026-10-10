import { createClient } from "@supabase/supabase-js";
import { ALTAR_PUBLIC_COLUMNS, type AltarLanguage, type FamilyAltarDay } from "./types";

function getPublicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Published Family Altar days in the given languages. The table only ever
 * holds the current and next week, and RLS only exposes status = 'ready'.
 */
export async function fetchPublishedAltarDays(languages: AltarLanguage[]): Promise<FamilyAltarDay[]> {
  const { data, error } = await getPublicClient()
    .from("family_altar_days")
    .select(ALTAR_PUBLIC_COLUMNS)
    .in("language", languages)
    .eq("status", "ready")
    .order("day", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FamilyAltarDay[];
}
