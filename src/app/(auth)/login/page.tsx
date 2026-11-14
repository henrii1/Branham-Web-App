import { AuthForm } from "@/components/auth/AuthForm";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";

export default async function LoginPage({
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
          Welcome back
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Log in to BranhamSermons.ai
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error_description ||
            "Authentication failed. Please try again."}
        </div>
      )}

      <AuthForm mode="login" next={next} />

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Don&apos;t have an account?{" "}
        <Link
          href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
