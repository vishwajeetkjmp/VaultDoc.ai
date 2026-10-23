import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import app, { auth, USE_EMULATORS } from "./firebase";
import { forgetDevice } from "./vault/device";

let functions: ReturnType<typeof getFunctions> | undefined;
function fns() {
  if (!functions) {
    functions = getFunctions(app, "asia-south2"); // same region as the Cloud Functions
    if (USE_EMULATORS) connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  return functions;
}

export function usesPassword(user: User) {
  return user.providerData.some((p) => p.providerId === "password");
}

export function usesGoogle(user: User) {
  return user.providerData.some((p) => p.providerId === "google.com");
}

/** Confirms it's really the account owner (password, or Google if there's no password). */
export async function confirmIdentity(user: User, password?: string) {
  if (usesPassword(user)) {
    if (!password) throw new Error("password-required");
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, password));
  } else {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  }
  // Fresh token, so the server sees the recent sign-in time
  await user.getIdToken(true);
}

/**
 * Permanently deletes the account and all its data on the server, then
 * removes this browser's Secure Vault unlock data and signs out.
 */
export async function deleteMyAccount(user: User) {
  const uid = user.uid;
  await httpsCallable(fns(), "deleteAccount")();
  await forgetDevice(uid).catch(() => {});
  try {
    localStorage.removeItem("vaultdoc-pin-reset-email");
  } catch {
    // storage unavailable
  }
  await signOut(auth).catch(() => {}); // the account is already gone on the server
}
