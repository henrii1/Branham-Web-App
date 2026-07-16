import Link from "next/link";

interface FaqGridProps {
  items: { slug: string; question: string }[];
  slugPrefix?: string;
}

export function FaqGrid({ items, slugPrefix = "/q" }: FaqGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <Link
          key={item.slug}
          href={`${slugPrefix}/${item.slug}`}
          className="group flex items-start justify-between rounded-xl border border-zinc-200 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700"
        >
          <h2 className="pr-3 text-sm font-semibold text-foreground lg:text-base">
            {item.question}
          </h2>
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
            />
          </svg>
        </Link>
      ))}
    </div>
  );
}