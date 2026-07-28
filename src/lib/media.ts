export type VideoEmbed = { type: "iframe" | "file"; src: string };

/**
 * Resolves an article's video_link into something renderable: YouTube and Vimeo become
 * player iframes, a direct media file becomes a <video> source. Anything else returns
 * null so callers can fall back to a plain link rather than embedding an unknown origin.
 *
 * Shared by the public article page, the agent article page, and the in-place article
 * modal so a video behaves the same wherever an article is opened.
 */
export function getVideoEmbed(url: string | null | undefined): VideoEmbed | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return { type: "iframe", src: `https://www.youtube.com/embed/${v}` };
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return { type: "iframe", src: `https://www.youtube.com/embed/${id}` };
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return { type: "iframe", src: `https://player.vimeo.com/video/${id}` };
    }
    if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) {
      return { type: "file", src: u.href };
    }
  } catch {
    return null;
  }
  return null;
}
