"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchResultCard, type SearchResult } from "./SearchResultList";

/**
 * The "Favorites / Pinned Articles area" — reachable without running a search.
 *
 * Pins are stored as bare article ids, so this resolves each one through the single-article
 * endpoint and renders it with the same card the search results use, keeping one visual
 * language across customer, agent and admin surfaces.
 */
export default function PinnedArticlesPanel({
  pinnedArticleIds,
  onOpen,
  onTogglePin,
  defaultOpen = false,
}: {
  pinnedArticleIds: string[];
  onOpen: (id: string) => void;
  onTogglePin?: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [items, setItems] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);

  const load = useCallback(async (ids: string[]) => {
    setLoading(true);
    const resolved: SearchResult[] = [];
    const missing: string[] = [];
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/v1/articles/${id}`, { cache: "no-store" });
          if (!res.ok) { missing.push(id); return; }
          const a = await res.json();
          resolved.push({
            article_id: a.id,
            title: a.title,
            category: a.category?.name ?? "—",
            // Pins are a user's own shortlist, not a ranked result — the card's score slot
            // is unused here, so mark it full rather than implying a weak match.
            match_score: 1,
            status: a.status,
            language: a.language,
          });
        } catch {
          missing.push(id);
        }
      })
    );
    // Keep the user's pin order rather than whichever request finished first.
    resolved.sort((a, b) => ids.indexOf(a.article_id) - ids.indexOf(b.article_id));
    setItems(resolved);
    setFailed(missing);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (pinnedArticleIds.length === 0) { setItems([]); setFailed([]); return; }
    load(pinnedArticleIds);
  }, [open, pinnedArticleIds, load]);

  if (pinnedArticleIds.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-zinc-900"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-900">
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
          <span className="flex-1 text-xs font-bold text-zinc-900">
            Pinned articles
            <span className="ml-1.5 font-semibold text-zinc-400">({pinnedArticleIds.length})</span>
          </span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </h3>

      {open && (
        <div className="border-t border-zinc-150 px-4 py-3">
          {loading && <p className="py-3 text-center text-xs font-semibold text-zinc-400">Loading your pinned articles…</p>}

          {!loading && items.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {items.map((r, i) => (
                <SearchResultCard
                  key={r.article_id}
                  result={r}
                  rank={i + 1}
                  pinned
                  onOpen={onOpen}
                  onTogglePin={onTogglePin}
                />
              ))}
            </ul>
          )}

          {!loading && failed.length > 0 && (
            <p className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
              {failed.length} pinned article{failed.length !== 1 ? "s are" : " is"} no longer available —
              it may have been archived or deleted.
            </p>
          )}

          {!loading && items.length === 0 && failed.length === 0 && (
            <p className="py-3 text-center text-xs font-semibold text-zinc-400">Nothing pinned yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
