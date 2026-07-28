import type { Locale } from "@/lib/i18n/locale-types";

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  fr: "fr-DZ",
};

const dateFormatters = new Map<Locale, Intl.DateTimeFormat>();
const dateTimeFormatters = new Map<Locale, Intl.DateTimeFormat>();

function dateFormatter(locale: Locale): Intl.DateTimeFormat {
  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    dateFormatters.set(locale, formatter);
  }
  return formatter;
}

function dateTimeFormatter(locale: Locale): Intl.DateTimeFormat {
  let formatter = dateTimeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    dateTimeFormatters.set(locale, formatter);
  }
  return formatter;
}

export function formatDate(date: Date | null | undefined, locale: Locale): string {
  return date ? dateFormatter(locale).format(date) : "—";
}

export function formatDateTime(date: Date | null | undefined, locale: Locale): string {
  return date ? dateTimeFormatter(locale).format(date) : "—";
}

export function formatAge(dateOfBirth: Date | null | undefined, locale: Locale): string {
  if (!dateOfBirth) return "—";
  const diff = Date.now() - dateOfBirth.getTime();
  const years = Math.floor(diff / (365.25 * 86_400_000));
  return locale === "fr" ? `${years} ans` : `${years} yrs`;
}

/** Date n days in the past — kept here so component render bodies stay pure. */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

/** Date n minutes in the past — kept here so component render bodies stay pure. */
export function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

/** "2 hours ago" style relative time for activity feeds. */
export function formatRelative(date: Date, locale: Locale): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return locale === "fr" ? "à l'instant" : "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return locale === "fr" ? `il y a ${minutes} min` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return locale === "fr" ? `il y a ${hours} h` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return locale === "fr" ? `il y a ${days} j` : `${days} d ago`;
  return dateFormatter(locale).format(date);
}
