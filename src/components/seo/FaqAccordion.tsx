"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface FaqItem {
  slug: string;
  question: string;
  excerpt: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = useCallback(
    (idx: number) => {
      setOpenIndex((prev) => (prev === idx ? null : idx));
    },
    [],
  );

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={item.slug}
          className="overflow-hidden rounded-lg border border-zinc-200 transition-colors dark:border-zinc-800"
        >
          <button
            type="button"
            onClick={() => toggle(idx)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            aria-expanded={openIndex === idx}
          >
            <h2 className="pr-4 text-sm font-semibold text-foreground lg:text-base">
              {item.question}
            </h2>
            <svg
              className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform duration-200 ${
                openIndex === idx ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19.5 8.25-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>

          {openIndex === idx && (
            <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {item.excerpt}
              </p>
              <Link
                href={`/q/${item.slug}`}
                className="mt-2 inline-block text-sm font-medium text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Read full answer →
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
