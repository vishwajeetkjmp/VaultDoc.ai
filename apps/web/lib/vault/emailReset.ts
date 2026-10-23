import { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink } from "firebase/auth";
import { auth } from "../firebase";

/**
 * "Forgot PIN": proves the user still controls their email before allowing a
 * new PIN on a device that already holds the vault. The email link never
 * carries or unlocks the vault key; it only re-confirms identity.
 */
const EMAIL_KEY = "vaultdoc-pin-reset-email";

export async function sendPinResetEmail(email: string) {
  await sendSignInLinkToEmail(auth, email, {
    url: `${window.location.origin}/vault?reset=1`,
    handleCodeInApp: true,
  });
  localStorage.setItem(EMAIL_KEY, email);
}

export function isPinResetLink() {
  return isSignInWithEmailLink(auth, window.location.href);
}

/** Completes the email link. Returns the verified user's uid, or null if the link is invalid or for someone else. */
export async function completePinReset(expectedUid: string): Promise<string | null> {
  const email = localStorage.getItem(EMAIL_KEY);
  if (!email) return null;
  try {
    const cred = await signInWithEmailLink(auth, email, window.location.href);
    localStorage.removeItem(EMAIL_KEY);
    return cred.user.uid === expectedUid ? cred.user.uid : null;
  } catch {
    return null;
  }
}
