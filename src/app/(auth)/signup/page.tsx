import { AuthForm } from "@/components/auth/AuthForm";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    error?: string;
    error_description?: string;
  }>;
}) {
  const { next, error, error_description } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <BrandLogo href="/" size={48} showName={false} className="mb-2 [&_img]:rounded-xl [&_img]:bg-white [&_img]:p-1 [&_img]:shadow-sm" />
        <h1 className="font-display text-[1.9rem] leading-tight text-foreground">
          Create your account
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Join BranhamSermons.ai to save your conversations
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error_description ||
            "Something went wrong. Please try again."}
        </div>
      )}

      <AuthForm mode="signup" next={next} />

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
