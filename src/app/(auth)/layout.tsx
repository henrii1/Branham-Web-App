export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background px-4 py-8">
      <div className="flex min-h-[calc(100dvh-4rem)] items-start justify-center sm:items-center">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
