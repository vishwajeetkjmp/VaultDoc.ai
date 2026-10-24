import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import app, { USE_EMULATORS } from "./firebase";

/**
 * Firebase App Check: proves requests to Firestore, Storage and our functions come from this website,
 * not from a script (bots can't run up AI or converter costs). Uses reCAPTCHA Enterprise, invisible to
 * people. Started just before the first backend client is created, so pages that don't talk to the
 * backend (home, pricing) never load it. Off on the emulators, or until NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set.
 *
 * Rollout: the server only watches at first (Firebase console → App Check shows verified vs unverified
 * traffic); enforcement is switched on once nearly everything is verified.
 */
let started = false;

export function startAppCheck() {
  if (started || typeof window === "undefined" || USE_EMULATORS) return;
  started = true;
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) return;
  // localhost against the real project: Firebase prints a debug token to register in the console
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
}
