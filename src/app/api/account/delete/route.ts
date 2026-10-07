import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/email/adminAllowlist";

interface RequestBody {
  confirmEmail?: string;
}

/**
 * Archives (soft-deletes) the signed-in user's account.
 *
 * Nothing is hard-deleted — see supabase/migrations/011_account_archive.sql:
 * the auth row is soft-deleted (data kept, email scrambled and freed for a
 * fresh signup, share links stop resolving), after recording the real
 * email in archived_accounts. The soft delete is irreversible.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // The operator accounts can't delete themselves (the profile page hides
  // the option too; this is the actual enforcement).
  if (isAdminEmail(user.email)) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const email = user.email?.trim().toLowerCase();
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const typed = body?.confirmEmail?.trim().toLowerCase();
  if (!email || !typed || typed !== email) {
    return Response.json({ ok: false, error: "email_mismatch" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Record the email first: once the soft delete runs, the auth row's email
  // is scrambled and this is the only link back to the archived data.
  // ignoreDuplicates keeps a retry after a failed soft delete idempotent.
  const { error: archiveError } = await admin
    .from("archived_accounts")
    .upsert({ user_id: user.id, email }, { onConflict: "user_id", ignoreDuplicates: true });

  if (archiveError) {
    console.error("Account archive record failed:", archiveError);
    return Response.json({ ok: false, error: "archive_failed" }, { status: 500 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, true);
  if (deleteError) {
    console.error("Account soft delete failed:", deleteError);
    return Response.json({ ok: false, error: "delete_failed" }, { status: 500 });
  }

  // The account no longer exists server-side, so only clear this browser's
  // session cookies — a global sign-out would call the auth server for a
  // user it has already removed.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  return Response.json({ ok: true });
}
