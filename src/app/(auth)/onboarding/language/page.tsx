import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingPreferencesForm } from "@/components/auth/OnboardingPreferencesForm";
import { SignOutButton } from "./SignOutButton";

export default async function LanguageSelectionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (user.user_metadata?.onboarding_completed === true) redirect("/chat");

  const { next } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Choose your language
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Select your preferred language for Branham Sermons Assistant
        </p>
      </div>

      <OnboardingPreferencesForm
        userId={user.id}
        redirectTo={next || "/chat"}
      />

      <div className="text-center">
        <SignOutButton />
      </div>
    </div>
  );
}
