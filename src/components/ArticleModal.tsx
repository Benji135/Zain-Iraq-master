"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "./Modal";
import { parseMarkdownToHtml } from "@/lib/markdown";
import { getVideoEmbed } from "@/lib/media";
import TroubleshootingPlayer from "./TroubleshootingPlayer";
import ArticleFeedbackForm from "./ArticleFeedbackForm";

type Channel = "default" | "agent" | "chatbot" | "whatsapp";

const CHANNEL_LABELS: Record<Channel, string> = {
  default: "Customer",
  agent: "Agent",
  chatbot: "Chatbot",
  whatsapp: "WhatsApp",
};

const STATUS_STYLES: Record<string, string> = {
  Published: "bg-green-50 text-green-700 ring-green-600/20",
  Draft: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
  InReview: "bg-amber-50 text-amber-700 ring-amber-600/20",
  Approved: "bg-blue-50 text-blue-700 ring-blue-600/20",
  Archived: "bg-zinc-100 text-zinc-500 ring-zinc-400/20",
  Rejected: "bg-red-50 text-red-700 ring-red-600/20",
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-3 w-24 animate-pulse rounded bg-zinc-150" />
      <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-150" />
      <div className="space-y-2 pt-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded bg-zinc-100"
            style={{ width: `${90 - i * 7}%`, animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export type ArticleModalProps = {
  articleId: string | null;
  open: boolean;
  onClose: () => void;
  /** Agent/admin surfaces default to the agent variant and show internal fields. */
  initialChannel?: Channel;
  /** Staff surfaces get the channel switcher and the copy-ready macro. */
  staffView?: boolean;
  /** Where "Open full page" points. Defaults to the public article route. */
  fullPageHref?: (id: string) => string;
};

export default function ArticleModal({
  articleId,
  open,
  onClose,
  initialChannel = "default",
  staffView = false,
  fullPageHref,
}: ArticleModalProps) {
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>(initialChannel);

  useEffect(() => {
    if (open) setChannel(initialChannel);
  }, [open, initialChannel]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/articles/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || `Could not load this article (${res.status}).`);
        setArticle(null);
      } else {
        setArticle(data);
      }
    } catch {
      setError("Network error — check your connection and try again.");
      setArticle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !articleId) return;
    setArticle(null);
    load(articleId);
  }, [open, articleId, load]);

  const variants = article?.variants ?? [];
  const activeVariant = variants.find((v: any) => v.channel === channel);
  const defaultVariant = variants.find((v: any) => v.channel === "default") ?? variants[0];
  const isFallback =
    channel !== "default" &&
    (!activeVariant || (!activeVariant.detailed_steps && !activeVariant.short_answer));
  const shown = isFallback ? defaultVariant : activeVariant ?? defaultVariant;

  const shortAnswer = shown?.short_answer?.trim() || "";
  const body = shown?.detailed_steps?.trim() || "";
  const macro = shown?.copy_ready_macro?.trim() || "";
  const image = shown?.image_url?.trim() || "";
  const embed = getVideoEmbed(shown?.video_link);
  const tags: string[] = (article?.article_tags ?? []).map((t: any) => t.tag?.name).filter(Boolean);

  const href = article ? (fullPageHref ? fullPageHref(article.id) : `/articles/${article.id}`) : "#";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={article?.title ?? (loading ? "Loading article…" : "Article")}
      subtitle={
        article
          ? [article.category?.name, article.language === "ar" ? "العربية" : "English"]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      headerAccessory={
        article ? (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {article.status && (
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${
                  STATUS_STYLES[article.status] ?? STATUS_STYLES.Draft
                }`}
              >
                {article.status}
              </span>
            )}
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            >
              Open full page
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            </Link>
          </div>
        ) : null
      }
    >
      {loading && <Skeleton />}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center">
          <p className="text-sm font-bold text-red-800">Couldn&apos;t open this article</p>
          <p className="mt-1.5 text-xs font-medium text-red-700">{error}</p>
          {articleId && (
            <button
              type="button"
              onClick={() => load(articleId)}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {!loading && !error && article && (
        <div className="space-y-6">
          {staffView && variants.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Content channel">
              {(Object.keys(CHANNEL_LABELS) as Channel[])
                .filter((c) => variants.some((v: any) => v.channel === c))
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={channel === c}
                    onClick={() => setChannel(c)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
                      channel === c
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
                    }`}
                  >
                    {CHANNEL_LABELS[c]}
                  </button>
                ))}
            </div>
          )}

          {isFallback && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
              No {CHANNEL_LABELS[channel]} variant exists — showing the Customer version.
            </p>
          )}

          {shortAnswer && (
            <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Short answer</h3>
                <CopyButton text={shortAnswer} />
              </div>
              <p className="text-sm leading-relaxed text-zinc-800">{shortAnswer}</p>
            </section>
          )}

          {body && (
            <section>
              <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Details</h3>
              <div
                className="prose-article text-sm leading-relaxed text-zinc-700"
                dir={article.language === "ar" ? "rtl" : undefined}
                dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(body) }}
              />
            </section>
          )}

          {!shortAnswer && !body && (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-8 text-center text-sm font-medium text-zinc-500">
              This article has no content for the selected channel yet.
            </p>
          )}

          {image && (
            <section>
              <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Picture guide</h3>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={`Illustration for ${article.title}`}
                className="w-full rounded-xl border border-zinc-200 object-contain"
              />
            </section>
          )}

          {embed && (
            <section>
              <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Video</h3>
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950">
                {embed.type === "iframe" ? (
                  <iframe
                    src={embed.src}
                    title={`Video for ${article.title}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="aspect-video w-full"
                  />
                ) : (
                  <video controls className="aspect-video w-full" preload="metadata">
                    <source src={embed.src} />
                    Your browser does not support embedded video.
                  </video>
                )}
              </div>
            </section>
          )}

          {shown?.troubleshooting_flow != null && (
            <section>
              <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Guided troubleshooting
              </h3>
              <TroubleshootingPlayer flow={shown.troubleshooting_flow} />
            </section>
          )}

          {staffView && macro && (
            <section className="rounded-xl border border-zinc-900/10 bg-zinc-900 p-5">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Copy-ready response
                </h3>
                <CopyButton text={macro} label="Copy response" />
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">{macro}</p>
            </section>
          )}

          {tags.length > 0 && (
            <section>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="border-t border-zinc-150 pt-5">
            <ArticleFeedbackForm articleId={article.id} />
          </section>
        </div>
      )}
    </Modal>
  );
}
