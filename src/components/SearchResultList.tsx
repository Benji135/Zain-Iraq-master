"use client";

import { useEffect, useState } from "react";

export type SearchResult = {
  article_id: string;
  title: string;
  category: string;
  match_score: number;
  status: string;
  language: string;
};

/** How many results are shown before the user asks for more. */
export const TOP_N = 3;

/**
 * Relevance bands. The scorer in /api/v1/search tops out at 1.0 for an exact title or
 * reference-number hit. Anything under 0.5 is filtered out server-side, so the lowest
 * band here is the floor of what can actually reach the page.
 */
function band(score: number) {
  if (score >= 0.8) return { label: "Strong match", cls: "bg-green-50 text-green-700 ring-green-600/20" };
  if (score >= 0.65) return { label: "Good match", cls: "bg-blue-50 text-blue-700 ring-blue-600/20" };
  return { label: "Partial match", cls: "bg-amber-50 text-amber-700 ring-amber-600/20" };
}

function PinButton({
  pinned,
  onClick,
}: {
  pinned: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pinned}
      aria-label={pinned ? "Unpin this article" : "Pin this article for quick access"}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
        pinned
          ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
          : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400 hover:text-zinc-800"
      }`}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="17" x2="12" y2="22" />
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
      </svg>
      {pinned ? "Pinned" : "Pin"}
    </button>
  );
}

export function SearchResultCard({
  result,
  rank,
  pinned,
  onOpen,
  onTogglePin,
}: {
  result: SearchResult;
  rank: number;
  pinned: boolean;
  onOpen: (id: string) => void;
  onTogglePin?: (id: string) => void;
}) {
  const pct = Math.round((result.match_score ?? 0) * 100);
  const b = band(result.match_score ?? 0);

  return (
    <li className="group relative rounded-xl border border-zinc-200 bg-white transition-all hover:border-zinc-300 hover:shadow-[0_2px_14px_rgba(0,0,0,0.07)] focus-within:border-zinc-400">
      <div className="flex items-start gap-4 p-4 sm:p-5">
        <span
          aria-hidden="true"
          className="mt-0.5 hidden w-6 shrink-0 text-right text-sm font-bold tabular-nums text-zinc-300 sm:block"
        >
          {rank}
        </span>

        <div className="min-w-0 flex-1">
          {/* The button covers the card via ::after so the whole row is one click target,
              while the pin control below stays independently clickable. */}
          <button
            type="button"
            onClick={() => onOpen(result.article_id)}
            className="text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-zinc-900"
          >
            <h4 className="text-sm font-bold leading-snug text-zinc-950 transition-colors group-hover:text-zinc-700">
              {result.title}
            </h4>
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-zinc-500">
              {result.category}
            </span>
            <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
              {(result.language || "en").toUpperCase()}
            </span>
            {result.status && result.status !== "Published" && (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                {result.status}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1 ring-inset ${b.cls}`}
            title={`${b.label} — relevance ${pct}%`}
          >
            {pct}%
          </span>
          {onTogglePin && (
            <span className="relative z-10">
              <PinButton pinned={pinned} onClick={() => onTogglePin(result.article_id)} />
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export default function SearchResultList({
  results,
  pinnedArticleIds,
  onOpen,
  onTogglePin,
  onClear,
}: {
  results: SearchResult[];
  pinnedArticleIds: string[];
  onOpen: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onClear?: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);

  // A fresh result set always starts collapsed.
  useEffect(() => setShowAll(false), [results]);

  const pinnedInResults = results.filter((r) => pinnedArticleIds.includes(r.article_id));
  // Offer the filter only when it would actually change what is on screen.
  const canFilterPinned = !!onTogglePin && pinnedInResults.length > 0 && pinnedInResults.length < results.length;
  const active = pinnedOnly && canFilterPinned ? pinnedInResults : results;

  const visible = showAll ? active : active.slice(0, TOP_N);
  const hidden = active.length - visible.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
          {active.length > TOP_N && !showAll
            ? `Top ${TOP_N} of ${active.length}`
            : `${active.length} result${active.length !== 1 ? "s" : ""}`}
          {pinnedOnly && canFilterPinned ? " — pinned only" : " — ranked by relevance"}
        </p>

        <div className="flex items-center gap-2">
          {canFilterPinned && (
            <button
              type="button"
              aria-pressed={pinnedOnly}
              onClick={() => { setPinnedOnly((v) => !v); setShowAll(false); }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
                pinnedOnly
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400 hover:text-zinc-800"
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill={pinnedOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
              </svg>
              Pinned only ({pinnedInResults.length})
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="rounded text-[10px] font-bold text-zinc-400 transition-colors hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-2.5">
        {visible.map((r, i) => (
          <SearchResultCard
            key={r.article_id}
            result={r}
            rank={i + 1}
            pinned={pinnedArticleIds.includes(r.article_id)}
            onOpen={onOpen}
            onTogglePin={onTogglePin}
          />
        ))}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full rounded-xl border border-dashed border-zinc-300 bg-white py-3 text-xs font-bold text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          Show {hidden} more result{hidden !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
