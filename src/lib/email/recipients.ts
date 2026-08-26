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

    for (const user of data.users) {
      if (user.email) emailByUserId.set(user.id, user.email);
    }

    if (data.users.length < LIST_USERS_PAGE_SIZE) break;
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
    admin.from("profiles").select("user_id, display_name").eq("language", language),
  ]);

  if (profilesResult.error) {
    throw new Error(`Failed to load profiles: ${profilesResult.error.message}`);
  }

  const recipients: EmailRecipient[] = [];
  for (const profile of (profilesResult.data ?? []) as Array<{
    user_id: string;
    display_name: string | null;
  }>) {
    const email = emailByUserId.get(profile.user_id);
    if (!email) continue;
    recipients.push({ email, displayName: profile.display_name ?? null });
  }
  return recipients;
}
