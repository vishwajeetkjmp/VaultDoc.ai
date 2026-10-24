import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from "firebase/functions";
import app, { USE_EMULATORS } from "./firebase";

export type Role = "owner" | "support" | "viewer";
export const RANK: Record<Role, number> = { viewer: 1, support: 2, owner: 3 };
export const can = (role: Role | null | undefined, min: Role) => !!role && RANK[role] >= RANK[min];

let functions: Functions | undefined;
function fns() {
  if (!functions) {
    functions = getFunctions(app, "asia-south2");
    if (USE_EMULATORS) connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  return functions;
}

/** Every admin request goes through the single adminApi function (role checks + audit log live there). */
export async function adminApi<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const r = await httpsCallable<Record<string, unknown>, T>(fns(), "adminApi", { timeout: 120_000 })({ action, ...data });
  return r.data;
}

export function errorText(e: unknown): string {
  const m = (e as { message?: string })?.message;
  return m && !/^internal$/i.test(m) ? m : "Something went wrong. Please try again.";
}

// ---- Response shapes ----
export type UserRow = {
  uid: string;
  email: string | null;
  name: string | null;
  photo: string | null;
  providers: string[];
  verified: boolean;
  disabled: boolean;
  role: Role | null;
  createdAt: number | null;
  lastActiveAt: number | null;
  usedBytes: number;
  fileCount: number;
  quotaBytes: number | null;
};
export type CurrentStats = {
  users: number;
  verified: number;
  disabled: number;
  google: number;
  newUsers7: number;
  newUsers30: number;
  activeUsers7: number;
  storageBytes: number;
  files: number;
  sharesActive: number;
  at: number;
};
export type DayStats = {
  day: string;
  signups?: number;
  users?: number;
  storageBytes?: number;
  conversions?: number;
  sharesCreated?: number;
  shareOpens?: number;
  shareDownloads?: number;
  inviteEmails?: number;
  aiQuestions?: number;
  aiAnalyses?: number;
  aiInputTokens?: number;
  aiCachedTokens?: number;
  aiOutputTokens?: number;
  remindersSent?: number;
};
