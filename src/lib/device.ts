import { UAParser } from "ua-parser-js";

/**
 * Turns a User-Agent string into a short human label for "last signed in from",
 * e.g. "macOS · Safari", "Windows · Chrome", "Android · Chrome Mobile (SM-G991B)".
 *
 * Exact phone/tablet model is best-effort only: modern Chrome (Android) sends
 * a frozen, model-less UA string by default ("Android 10; K") unless the
 * client opts in to User-Agent Client Hints — Safari and Firefox never expose
 * the model via UA at all. When no model is available we fall back to the OS.
 */
export function describeDevice(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;

  const { os, browser, device } = UAParser(userAgent);

  const osLabel = [os.name, os.version].filter(Boolean).join(" ") || null;
  const browserLabel = [browser.name, browser.major].filter(Boolean).join(" ") || null;
  const deviceModel = [device.vendor, device.model].filter(Boolean).join(" ") || null;

  const parts: string[] = [];
  if (osLabel) parts.push(osLabel);
  if (browserLabel) parts.push(browserLabel);

  let label = parts.join(" · ");
  if (deviceModel) label += label ? ` (${deviceModel})` : deviceModel;

  return label || null;
}
