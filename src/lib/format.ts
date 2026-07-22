const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(date: Date | null | undefined): string {
  return date ? DATE_FMT.format(date) : "—";
}

export function formatDateTime(date: Date | null | undefined): string {
  return date ? DATETIME_FMT.format(date) : "—";
}

export function formatAge(dateOfBirth: Date | null | undefined): string {
  if (!dateOfBirth) return "—";
  const diff = Date.now() - dateOfBirth.getTime();
  return `${Math.floor(diff / (365.25 * 86_400_000))} yrs`;
}

/** Date n days in the past — kept here so component render bodies stay pure. */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

/** "2 hours ago" style relative time for activity feeds. */
export function formatRelative(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return DATE_FMT.format(date);
}
