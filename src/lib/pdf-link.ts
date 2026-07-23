/**
 * True when `link` is something a browser can actually navigate to — either a
 * real http(s) URL, or a path on this app's own origin (e.g. a locally hosted
 * sample/demo PDF). A raw local filesystem path like "C:\..." from SERVER A
 * is neither — see docs/API.md "Clinic source contract" for that tradeoff.
 */
export function isOpenableUrl(link: string | null | undefined): link is string {
  if (!link) return false;
  if (link.startsWith("/")) return true;
  try {
    const url = new URL(link);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
