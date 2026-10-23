const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / Math.pow(1024, i);
  // "1 GB" rather than "1.0 GB", but keep "1.5 GB"
  const shown = value >= 100 || i === 0 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
  return `${shown} ${UNITS[i]}`;
}

const sameYear = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const otherYear = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** Gmail-style: "3:42 PM" today, "12 Oct" this year, "12 Oct 2025" otherwise */
export function formatDate(date: Date | null): string {
  if (!date) return "—";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return time.format(date);
  return (date.getFullYear() === now.getFullYear() ? sameYear : otherYear).format(date);
}
