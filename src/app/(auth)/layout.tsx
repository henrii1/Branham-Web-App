export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-dvh overflow-y-auto bg-background px-4 py-8">
      <div className="flex min-h-full items-start justify-center sm:items-center">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
