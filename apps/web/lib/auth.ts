import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  sendEmailVerification,
  User,
} from "firebase/auth";
import { auth } from "./firebase";

export async function signUp(email: string, password: string, name?: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name?.trim()) {
    // Store the name on the Firebase user so the profile menu can greet them by it
    await updateProfile(cred.user, { displayName: name.trim() });
  }
  await sendVerificationEmail(cred.user).catch(() => {
    // The verify screen offers "Resend" if this didn't go out
  });
  return cred;
}

export function sendVerificationEmail(user: User) {
  return sendEmailVerification(user, { url: `${window.location.origin}/dashboard` });
}

/**
 * Re-reads the account after the user clicks the verification link, and
 * refreshes their sign-in token so the server rules see the verified status.
 */
export async function refreshVerification(user: User): Promise<boolean> {
  await user.reload();
  if (user.emailVerified) await user.getIdToken(true);
  return user.emailVerified;
}

export function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

let signingOut = false;

/** True while a deliberate sign-out is in progress, so protected pages don't bounce to /signin. */
export function isSigningOut() {
  return signingOut;
}

export async function signOutUser() {
  signingOut = true;
  try {
    await signOut(auth);
  } finally {
    // Give the redirect to the landing page time to happen before guards resume
    setTimeout(() => (signingOut = false), 1000);
  }
}

/** Fires on sign-in, sign-out and token refresh (e.g. after email verification). */
export function onAuthChange(callback: (user: User | null) => void) {
  return onIdTokenChanged(auth, callback);
}
