import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileContent } from "./ProfileContent";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, display_name, language, created_at")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Your profile
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage your account settings
        </p>
      </div>

      <ProfileContent
        user={{
          id: user.id,
          email: user.email ?? "",
          displayName: profile?.display_name ?? undefined,
        }}
        currentLanguage={profile?.language ?? "en"}
      />
    </div>
  );
}
