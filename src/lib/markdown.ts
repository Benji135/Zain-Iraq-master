/**
 * Safely parses basic Markdown syntax into HTML strings to render rich text,
 * links, lists, and images in the article views.
 */

// Blocks script-executing URL schemes; relative, http(s), mailto, and tel links pass through.
function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^(https?|mailto|tel):/i.test(trimmed)) {
    return "#";
  }
  return trimmed;
}

// Escapes characters that would otherwise let attacker-controlled text break out of an
// HTML attribute value (the markdown link/image syntax interpolates raw text here).
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function parseMarkdownToHtml(markdown: string | null | undefined): string {
  if (!markdown) return "";

  // If the content contains HTML tags, treat it as HTML and safely sanitize it
  const isHtml = /<[a-z][\s\S]*>/i.test(markdown);
  if (isHtml) {
    let clean = markdown;
    // Strip tags that can execute script or load arbitrary external documents outright.
    clean = clean.replace(/<(script|iframe|object|embed|link|style|base|form|meta)[\s\S]*?<\/\1\s*>/gi, "");
    clean = clean.replace(/<(script|iframe|object|embed|link|style|base|form|meta)\b[^>]*\/?>(?!<\/\1>)/gi, "");
    // Strip inline event handlers — preceded by whitespace OR a `/` (self-closing tags like <svg/onload=...>).
    clean = clean.replace(/[\s/]on\w+\s*=\s*(['"]).*?\1/gi, "");
    clean = clean.replace(/[\s/]on\w+\s*=\s*[^"'\s>]+/gi, "");
    // Neutralize script-executing URL schemes in any href/src/action-style attribute.
    clean = clean.replace(/((?:href|src|action|formaction)\s*=\s*)(['"])\s*(?:javascript|vbscript|data):.*?\2/gi, '$1$2#$2');
    return clean;
  }

  // 1. Escape HTML special characters to prevent XSS (allowing only safe tags like <u>)
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;u&gt;/g, "<u>")
    .replace(/&lt;\/u&gt;/g, "</u>");

  // 2. Parse Headings (multiline regex to match start of lines)
  html = html
    .replace(/^## (.*?)$/gm, '<h2 class="text-base font-extrabold text-zinc-950 mt-4 mb-2">$1</h2>')
    .replace(/^# (.*?)$/gm, '<h1 class="text-lg font-extrabold text-zinc-950 mt-5 mb-2.5">$1</h1>');

  // 3. Parse Images: ![alt](url)
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (_m, alt: string, url: string) => {
    const safeUrl = escapeAttr(sanitizeUrl(url));
    const safeAlt = escapeAttr(alt);
    return `<img src="${safeUrl}" alt="${safeAlt}" class="my-4 max-w-full rounded-lg border border-zinc-200 shadow-xs object-cover" />`;
  });

  // 4. Parse Links: [text](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, (_m, text: string, url: string) => {
    const safeUrl = escapeAttr(sanitizeUrl(url));
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-semibold">${text}</a>`;
  });

  // 5. Parse Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-zinc-950">$1</strong>');

  // 6. Parse Italic: *text*
  html = html.replace(/\*(.*?)\*/g, '<em class="italic text-zinc-700">$1</em>');

  // 7. Parse Lists (Bullet & Numbered)
  html = html.replace(/^- (.*?)$/gm, '<li class="ml-4 list-disc pl-1">$1</li>');
  html = html.replace(/^\d+\.\s+(.*?)$/gm, '<li class="ml-4 list-decimal pl-1">$1</li>');

  return html;
}
