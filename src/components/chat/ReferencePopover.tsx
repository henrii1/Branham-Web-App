"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchReference,
  parsePillElement,
  type ReferenceResponse,
  type SermonReference,
} from "@/lib/chat/references";

type Status = "loading" | "success" | "error";

interface SermonResult {
  ref: SermonReference;
  status: Status;
  data: ReferenceResponse | null;
}

/**
 * Sermon-reference tooltip host.
 *
 * Mounted once per surface that renders citation pills (ChatShell, SeoShell).
 * Citation HTML is injected via dangerouslySetInnerHTML, so individual pills
 * can't carry React handlers — instead this component delegates: a single
 * document-level listener catches clicks / Enter / Space on any
 * `.citation-pill--clickable`, opens a centered dialog, and fetches the cited
 * paragraphs from `/api/reference`. A pill can bundle multiple sermons; each is
 * fetched independently and rendered as its own block.
 *
 * Dismissal: the X button, a click on the backdrop, or Esc. Focus returns to
 * the pill that opened the dialog.
 */
export function ReferencePopover() {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SermonResult[]>([]);

  const anchorRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
    const anchor = anchorRef.current;
    if (anchor) {
      requestAnimationFrame(() => anchor.focus?.());
    }
  }, []);

  const openForPill = useCallback((pill: HTMLElement) => {
    const refs = parsePillElement(pill);
    if (!refs || refs.length === 0) return;

    anchorRef.current = pill;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setResults(refs.map((ref) => ({ ref, status: "loading", data: null })));
    setOpen(true);

    refs.forEach((ref, index) => {
      fetchReference(ref, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          setResults((prev) =>
            prev.map((r, i) =>
              i === index ? { ...r, status: "success", data } : r,
            ),
          );
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setResults((prev) =>
            prev.map((r, i) =>
              i === index ? { ...r, status: "error", data: null } : r,
            ),
          );
        });
    });
  }, []);

  const retryOne = useCallback(
    (index: number) => {
      const target = results[index];
      const controller = abortRef.current;
      if (!target || !controller || controller.signal.aborted) return;

      setResults((prev) =>
        prev.map((r, i) =>
          i === index ? { ...r, status: "loading", data: null } : r,
        ),
      );

      fetchReference(target.ref, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          setResults((prev) =>
            prev.map((r, i) =>
              i === index ? { ...r, status: "success", data } : r,
            ),
          );
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setResults((prev) =>
            prev.map((r, i) =>
              i === index ? { ...r, status: "error", data: null } : r,
            ),
          );
        });
    },
    [results],
  );

  // ── Delegated open: click / Enter / Space on a clickable pill ────────
  useEffect(() => {
    const findPill = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>(".citation-pill--clickable");
    };

    const onClick = (e: MouseEvent) => {
      const pill = findPill(e.target);
      if (!pill) return;
      e.preventDefault();
      openForPill(pill);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const pill = findPill(e.target);
      if (!pill) return;
      e.preventDefault();
      openForPill(pill);
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openForPill]);

  // ── Esc to close + focus the close button on open ────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const single = results.length === 1;
  const headerTitle = single
    ? results[0]?.data?.title || results[0]?.ref.title || "Sermon reference"
    : "Sermon references";
  const headerDateId = single
    ? results[0]?.data?.date_id || results[0]?.ref.date_id || ""
    : "";

  return createPortal(
    <div
      className="reference-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="reference-popover"
        role="dialog"
        aria-modal="true"
        aria-label={`Sermon reference: ${headerTitle}`}
      >
        <header className="reference-popover__header">
          <div className="reference-popover__heading">
            <span className="reference-popover__title">{headerTitle}</span>
            {headerDateId && (
              <span className="reference-popover__dateid">{headerDateId}</span>
            )}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="reference-popover__close"
            onClick={close}
            aria-label="Close reference"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="reference-popover__body">
          {results.map((result, index) => (
            <SermonBlock
              key={`${result.ref.date_id}-${index}`}
              result={result}
              showHeader={!single}
              onRetry={() => retryOne(index)}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SermonBlock({
  result,
  showHeader,
  onRetry,
}: {
  result: SermonResult;
  showHeader: boolean;
  onRetry: () => void;
}) {
  const { ref, status, data } = result;

  return (
    <div className="reference-sermon">
      {showHeader && (
        <div className="reference-sermon__header">
          <span className="reference-sermon__title">
            {data?.title || ref.title || "Sermon"}
          </span>
          <span className="reference-sermon__dateid">
            {data?.date_id || ref.date_id}
          </span>
        </div>
      )}

      {status === "loading" && <ReferenceSkeleton />}

      {status === "error" && (
        <div className="reference-popover__state">
          <p>Couldn&rsquo;t load this reference.</p>
          <button
            type="button"
            className="reference-popover__retry"
            onClick={onRetry}
          >
            Try again
          </button>
        </div>
      )}

      {status === "success" && data && <ReferenceGroups data={data} />}
    </div>
  );
}

function ReferenceSkeleton() {
  return (
    <div className="reference-skeleton" aria-hidden="true">
      <span className="reference-skeleton__caption" />
      <span className="reference-skeleton__line" />
      <span className="reference-skeleton__line" />
      <span className="reference-skeleton__line reference-skeleton__line--short" />
    </div>
  );
}

function ReferenceGroups({ data }: { data: ReferenceResponse }) {
  if (!data.groups || data.groups.length === 0) {
    return (
      <div className="reference-popover__state">
        <p>This reference isn&rsquo;t available.</p>
      </div>
    );
  }

  return (
    <>
      {data.groups.map((group, i) => {
        const { paragraph_start, paragraph_end } = group.requested;
        const caption =
          paragraph_end && paragraph_end !== paragraph_start
            ? `¶${paragraph_start}–¶${paragraph_end}`
            : `¶${paragraph_start}`;

        return (
          <section
            key={`${paragraph_start}-${paragraph_end ?? paragraph_start}-${i}`}
            className="reference-group"
          >
            <h3 className="reference-group__caption">{caption}</h3>
            {group.paragraphs.length === 0 ? (
              <p className="reference-group__empty">
                This passage isn&rsquo;t available.
              </p>
            ) : (
              group.paragraphs.map((p, j) => (
                <p
                  key={`${p.paragraph_no}-${p.sub_id}-${j}`}
                  className={
                    p.is_context
                      ? "reference-paragraph reference-paragraph--context"
                      : "reference-paragraph"
                  }
                >
                  <span className="reference-paragraph__no">
                    ¶{p.paragraph_no}
                    {p.sub_id}
                  </span>
                  {p.text}
                </p>
              ))
            )}
          </section>
        );
      })}
    </>
  );
}
