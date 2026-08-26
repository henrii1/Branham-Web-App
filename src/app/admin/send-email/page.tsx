import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/email/adminAllowlist";
import { SendEmailForm } from "@/components/admin/SendEmailForm";

export default async function SendEmailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/chat");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="font-display text-3xl text-foreground">Send bulk email</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Compose a message and send it to every registered user whose saved language matches
          your selection.
        </p>
      </div>
      <SendEmailForm />
    </div>
  );
}
