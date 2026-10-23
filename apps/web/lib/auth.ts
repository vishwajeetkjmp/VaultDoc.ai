import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  User,
} from "firebase/auth";
import { auth } from "./firebase";

export async function signUp(email: string, password: string, name?: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name?.trim()) {
    // Store the name on the Firebase user so the profile menu can greet them by it
    await updateProfile(cred.user, { displayName: name.trim() });
  }
  return cred;
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

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
