export function bytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(Math.abs(n)) / Math.log(1024)));
  const v = n / 1024 ** i;
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}
export const num = (n: number) => new Intl.NumberFormat("en-IN").format(n);
export function date(ms: number | null, withTime = false): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) });
}
export function ago(ms: number | null): string {
  if (!ms) return "never";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 30 * 86400) return `${Math.round(s / 86400)} d ago`;
  return date(ms);
}
export const USD_TO_INR = 84;
/** AI cost is stored in micro-dollars (1 USD = 1,000,000) and shown in rupees. */
export function inr(microUsd: number): string {
  if (!microUsd) return "₹0";
  const r = (microUsd / 1e6) * USD_TO_INR;
  return r < 0.01 ? "< ₹0.01" : `₹${r.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
