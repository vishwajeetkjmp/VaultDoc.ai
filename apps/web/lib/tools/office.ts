import { EMULATOR_PROJECT_ID, USE_EMULATORS } from "../firebase";

/** Word → PDF runs on a server (see functions/src/convert.ts); everything else in the free tools is local. */
const ENDPOINT = USE_EMULATORS
  ? `http://127.0.0.1:5001/${EMULATOR_PROJECT_ID}/asia-south2/convertDocument`
  : `https://asia-south2-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/convertDocument`;

export async function convertWordToPdf(file: File, signal?: AbortSignal): Promise<Blob> {
  if (file.size > 20 * 1024 * 1024) throw new Error("This file is larger than 20 MB.");
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      body: file,
      headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
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
  return res.blob();
}
