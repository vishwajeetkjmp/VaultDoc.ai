import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from "firebase/functions";
import app, { USE_EMULATORS } from "./firebase";

let functions: Functions | undefined;

/** Cloud Functions client, created on first use (same region as the functions). */
export function fns(): Functions {
  if (!functions) {
    functions = getFunctions(app, "asia-south2");
    if (USE_EMULATORS) connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  return functions;
}

/** Calls a callable function and returns its data. */
export async function call<Req, Res>(name: string, data: Req): Promise<Res> {
  const result = await httpsCallable<Req, Res>(fns(), name)(data);
  return result.data;
}

/** The friendly message and `reason` detail from a failed call. */
export function callError(e: unknown): { message: string; reason?: string; details?: Record<string, unknown> } {
  const err = e as { message?: string; details?: Record<string, unknown> };
  const details = err?.details && typeof err.details === "object" ? err.details : undefined;
  return {
    message: err?.message && !/^internal$/i.test(err.message) ? err.message : "Something went wrong. Please try again.",
    reason: typeof details?.reason === "string" ? details.reason : undefined,
    details,
  };
}
