"use client";

import { useState } from "react";
import Link from "next/link";
import { groupName, SECTION_LABELS, type FaqGroup, type FaqListItem, type FaqSection } from "@/lib/faq/groups";

type Lang = "en" | "es" | "fr";

const COPY: Record<Lang, { questions: (n: number) => string; showAll: (n: number) => string; showFewer: string }> = {
  en: { questions: (n) => `${n} question${n === 1 ? "" : "s"}`, showAll: (n) => `Show all ${n}`, showFewer: "Show fewer" },
  es: { questions: (n) => `${n} pregunta${n === 1 ? "" : "s"}`, showAll: (n) => `Ver las ${n}`, showFewer: "Ver menos" },
  fr: { questions: (n) => `${n} question${n === 1 ? "" : "s"}`, showAll: (n) => `Voir les ${n}`, showFewer: "Voir moins" },
};

function Arrow() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-600 dark:group-hover:text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
    </svg>
  );
}

function QuestionLink({ item, slugPrefix }: { item: FaqListItem; slugPrefix: string }) {
  return (
    <Link
      href={`${slugPrefix}/${item.slug}`}
      className="group flex items-start justify-between gap-3 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 lg:px-5 lg:text-[15px] dark:hover:bg-zinc-800/60"
    >
      <span>{item.question}</span>
      <Arrow />
    </Link>
  );
}

/**
 * One group: its name and count, its first (oldest) question always shown,
 * the rest opening in place. `wide` spans the grid with a two-column list.
 */
function GroupCard({
  id,
  title,
  items,
  slugPrefix,
  wide,
  c,
}: {
  id: string;
  title: string | null;
  items: FaqListItem[];
  slugPrefix: string;
  wide?: boolean;
  c: (typeof COPY)[Lang];
}) {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = items;
  const listId = `faq-group-${id}`;
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-[var(--surface-base)] dark:border-zinc-800 ${wide ? "lg:col-span-2" : ""}`}>
      {/* Untitled (the doctrinal card): its name and count are the section heading. */}
      {title && (
        <button
          type="button"
          onClick={() => rest.length && setOpen((o) => !o)}
          aria-expanded={rest.length ? open : undefined}
          aria-controls={rest.length ? listId : undefined}
          className="flex w-full items-baseline justify-between gap-3 px-4 pt-4 pb-1.5 text-left lg:px-5"
        >
          <h3 className="font-display text-[1.15rem] leading-tight text-foreground">{title}</h3>
          <span className="shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{c.questions(items.length)}</span>
        </button>
      )}
      <div className={title ? "pb-2" : "pt-2 pb-2"}>
        <QuestionLink item={first} slugPrefix={slugPrefix} />
      </div>
      {rest.length > 0 && (
        <>
          <div id={listId} className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <ul className={`border-t border-zinc-200 py-1 dark:border-zinc-800 ${wide ? "lg:columns-2 lg:gap-0" : ""}`} inert={!open}>
                {rest.map((item) => (
                  <li key={item.slug} className="break-inside-avoid">
                    <QuestionLink item={item} slugPrefix={slugPrefix} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={listId}
            className="mx-4 mb-3.5 flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 hover:text-foreground lg:mx-5 dark:text-zinc-400"
          >
            {open ? c.showFewer : c.showAll(items.length)}
            <svg className={`h-3.5 w-3.5 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

/** A section of named groups as a grid of cards. */
function GroupSection({ title, sections, slugPrefix, lang, c }: { title: string; sections: FaqSection<FaqListItem>[]; slugPrefix: string; lang: Lang; c: (typeof COPY)[Lang] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-[1.4rem] leading-tight text-foreground">{title}</h2>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {sections.map((s) => (
          <GroupCard key={s.group!.id} id={s.group!.id} title={groupName(s.group!, lang)} items={s.items} slugPrefix={slugPrefix} c={c} />
        ))}
      </div>
    </section>
  );
}

/**
 * The FAQ list as groups: Christianity Seen in Nature first, then Bible
 * questions (each holding named groups), then the doctrinal group last. Each
 * group shows its oldest question and opens to the rest. Same layout in
 * en/es/fr; question URLs are unchanged.
 */
export function FaqGroups({
  nature,
  bible,
  doctrinal,
  language,
  slugPrefix = "/q",
}: {
  nature: FaqSection<FaqListItem>[];
  bible: FaqSection<FaqListItem>[];
  doctrinal: FaqSection<FaqListItem> | null;
  language: string;
  slugPrefix?: string;
}) {
  const lang: Lang = language === "es" || language === "fr" ? language : "en";
  const c = COPY[lang];
  const doctrinalTitle = doctrinal?.group ? groupName(doctrinal.group as FaqGroup, lang) : SECTION_LABELS.doctrinal[lang];
  return (
    <div className="flex flex-col gap-9">
      {nature.length > 0 && <GroupSection title={SECTION_LABELS.nature[lang]} sections={nature} slugPrefix={slugPrefix} lang={lang} c={c} />}
      {bible.length > 0 && <GroupSection title={SECTION_LABELS.bible[lang]} sections={bible} slugPrefix={slugPrefix} lang={lang} c={c} />}
      {doctrinal && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[1.4rem] leading-tight text-foreground">{doctrinalTitle}</h2>
            <span className="shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{c.questions(doctrinal.items.length)}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <GroupCard id={doctrinal.group?.id ?? "doctrinal"} title={null} items={doctrinal.items} slugPrefix={slugPrefix} wide c={c} />
          </div>
        </section>
      )}
    </div>
  );
}
