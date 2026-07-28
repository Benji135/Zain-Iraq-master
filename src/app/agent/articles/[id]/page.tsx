import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { parseMarkdownToHtml } from "@/lib/markdown";
import AgentArticleClient from "./AgentArticleClient";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; categoryId?: string }>;
};

/** Strip HTML tags and all markdown syntax, returning clean plain text. */
function stripMarkdown(raw: string): string {
  return raw
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1") // <a>text</a> → text (keep label)
    .replace(/<[^>]+>/g, "")                  // remaining HTML tags
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ") // HTML entities
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) → text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")     // images
    .replace(/#{1,6}\s*/g, "")                // headers
    .replace(/\*\*([^*]+)\*\*/g, "$1")        // bold
    .replace(/\*([^*]+)\*/g, "$1")            // italic
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")       // code
    .replace(/https?:\/\/\S+/g, "")           // bare URLs
    .replace(/[-*+]\s+/g, "")                 // unordered bullets
    .replace(/\s{2,}/g, " ")
    .trim();
}


export default async function AgentArticlePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { q: backQuery, categoryId } = await searchParams;

  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, tenant_id: tenantId } = session.user;
  if (role !== "Agent" && role !== "Admin" && role !== "SuperAdmin") redirect("/login");

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      category: true,
      author: { select: { name: true } },
      variants: true,
      feedback: {
        select: { helpful: true },
        orderBy: { created_at: "desc" },
        take: 200,
      },
    },
  });

  if (!article || article.tenant_id !== tenantId) notFound();

  // Prefer agent variant, fall back to default
  const agentVar = article.variants.find((v) => v.channel === "agent");
  const defaultVar = article.variants.find((v) => v.channel === "default");
  const displayVar = agentVar ?? defaultVar;

  const shortAnswer = stripMarkdown(displayVar?.short_answer ?? "");
  const rawSteps = displayVar?.detailed_steps ?? "";
  // The macro is pasted straight into a customer conversation, so it stays plain text.
  const copyMacro = stripMarkdown(displayVar?.copy_ready_macro ?? "") || shortAnswer;
  const troubleshootingFlow = displayVar?.troubleshooting_flow ?? null;

  // Render the article body as written. This page used to regex-split the body into
  // "numbered steps" (lines starting with a digit) plus an "internal note" (the first
  // three remaining prose lines) and drop everything else — so headings, bullet lists,
  // tables, images and any prose past the third line never reached the agent, and plain
  // article prose was mislabelled as an agents-only internal note. The body now goes
  // through the same markdown pipeline as the customer page and the article modal.
  const bodyHtml = rawSteps.trim() ? parseMarkdownToHtml(rawSteps) : "";
  const imageUrl = displayVar?.image_url?.trim() || "";
  const videoLink = displayVar?.video_link?.trim() || "";

  // Delivery channels — channels that have at least one content field populated
  const channelLabels: Record<string, string> = {
    default: "Website",
    agent: "Agent Portal",
    chatbot: "Chatbot",
    whatsapp: "WhatsApp",
  };
  const deliveryChannels = article.variants
    .filter((v) => v.short_answer || v.detailed_steps || v.copy_ready_macro)
    .map((v) => channelLabels[v.channel] ?? v.channel);

  // Feedback stats
  const totalFeedback = article.feedback.length;
  const helpfulCount = article.feedback.filter((f) => f.helpful).length;
  const helpfulPct = totalFeedback > 0 ? Math.round((helpfulCount / totalFeedback) * 100) : null;

  return (
    <AgentArticleClient
      article={{
        id: article.id,
        title: article.title,
        status: article.status,
        language: article.language,
        category: article.category?.name ?? "General",
        categoryId: article.category_id ?? undefined,
        shortAnswer,
        copyMacro,
        bodyHtml,
        imageUrl,
        videoLink,
        troubleshootingFlow,
        deliveryChannels,
        helpfulPct,
        totalFeedback,
      }}
      backQuery={backQuery}
      backCategoryId={categoryId}
    />
  );
}
