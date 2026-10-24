import { auth, EMULATOR_PROJECT_ID, USE_EMULATORS } from "../firebase";

/** Word → PDF runs on a server (see functions/src/convert.ts); everything else in the free tools is local. */
const ENDPOINT = USE_EMULATORS
  ? `http://127.0.0.1:5001/${EMULATOR_PROJECT_ID}/asia-south2/convertDocument`
  : `https://asia-south2-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/convertDocument`;

/** Word to PDF without an account: conversions today in this browser (see WORD_TRIAL_PER_DAY). */
const TRIAL_KEY = "vaultdoc-word-trial";
const today = () => new Date().toLocaleDateString("en-CA");

export function trialUsedToday(): number {
  try {
    const saved = JSON.parse(localStorage.getItem(TRIAL_KEY) ?? "null") as { day: string; count: number } | null;
    return saved?.day === today() ? saved.count : 0;
  } catch {
    return 0;
  }
}

function countTrialUse() {
  try {
    localStorage.setItem(TRIAL_KEY, JSON.stringify({ day: today(), count: trialUsedToday() + 1 }));
  } catch {
    // Private browsing: the server's own limit still applies
  }
}

export async function convertWordToPdf(file: File, signal?: AbortSignal): Promise<Blob> {
  if (file.size > 20 * 1024 * 1024) throw new Error("This file is larger than 20 MB.");
  // Logged in: the converter checks this token. Without one, it converts .docx under its daily limit.
  const token = await auth.currentUser?.getIdToken();
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      body: file,
      headers: {
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    });
  } catch {
    throw new Error("Couldn't reach the converter. Check your connection and try again.");
  }
  if (!res.ok) {
    const message = await res
      .json()
      .then((j: { error?: string }) => j.error)
      .catch(() => null);
    throw new Error(message ?? "Conversion failed. Please try again.");
  }
  const pdf = await res.blob();
  if (!token) countTrialUse();
  return pdf;
}
