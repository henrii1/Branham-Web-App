import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailLanguage } from "./greeting";

export interface EmailRecipient {
  email: string;
  displayName: string | null;
}

const LIST_USERS_PAGE_SIZE = 1000;

async function buildEmailMap(admin: SupabaseClient): Promise<Map<string, string>> {
  const emailByUserId = new Map<string, string>();
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PAGE_SIZE,
    });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    if (data.users.length === 0) break;

    for (const user of data.users) {
      if (!user.email) continue;
      if (!user.email_confirmed_at) continue;
      if (user.banned_until) continue;
      if (user.deleted_at) continue;
      emailByUserId.set(user.id, user.email);
    }

    page += 1;
  }

  return emailByUserId;
}

/**
 * Resolves every registered user whose saved profiles.language matches
 * `language`, joined against their auth.users email (profiles has no email
 * column -- this is the only supported way to get one). Profiles with no
 * matching auth user are skipped defensively -- shouldn't happen given the
 * FK + cascade delete on profiles.user_id, but never crash a bulk send
 * over it.
 */
export async function resolveRecipients(
  admin: SupabaseClient,
  language: EmailLanguage,
): Promise<EmailRecipient[]> {
  const [emailByUserId, profilesResult] = await Promise.all([
    buildEmailMap(admin),
    admin
      .from("profiles")
      .select("user_id, display_name", { count: "exact" })
      .eq("language", language),
  ]);

  if (profilesResult.error) {
    throw new Error(`Failed to load profiles: ${profilesResult.error.message}`);
  }

  const rows = (profilesResult.data ?? []) as Array<{
    user_id: string;
    display_name: string | null;
  }>;

  if (profilesResult.count !== null && rows.length !== profilesResult.count) {
    throw new Error(
      `Profiles query returned ${rows.length} rows but ${profilesResult.count} exist for language "${language}" — results were truncated (likely Supabase's max-rows limit). Refusing to resolve a partial recipient list.`,
    );
  }

  const recipients: EmailRecipient[] = [];
  for (const profile of rows) {
    const email = emailByUserId.get(profile.user_id);
    if (!email) continue;
    recipients.push({ email, displayName: profile.display_name ?? null });
  }
  return recipients;
}
