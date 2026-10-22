import type { User } from "firebase/auth";

// Same family of colours Gmail uses for letter avatars.
const AVATAR_COLORS = [
  "#1a73e8",
  "#d93025",
  "#188038",
  "#e37400",
  "#9334e6",
  "#c5221f",
  "#007b83",
  "#b80672",
  "#5f6368",
  "#3949ab",
];

/** Best name we have: profile name, else the part of the email before "@". */
export function getDisplayName(user: User): string {
  if (user.displayName?.trim()) return user.displayName.trim();
  if (user.email) return user.email.split("@")[0];
  return "User";
}

export function getFirstName(user: User): string {
  return getDisplayName(user).split(/\s+/)[0];
}

export function getInitial(user: User): string {
  return getDisplayName(user).charAt(0).toUpperCase() || "?";
}

/** Stable colour per user, so the same person always gets the same circle. */
export function getAvatarColor(user: User): string {
  const key = user.email ?? user.uid;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Gravatar picture for an email address, or null if hashing isn't available.
 * `d=404` makes Gravatar fail when there's no picture, so the caller can fall
 * back to the letter avatar instead of showing a generic placeholder.
 */
export async function getGravatarUrl(email: string, size = 160): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}
