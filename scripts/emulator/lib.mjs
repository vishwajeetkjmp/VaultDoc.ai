// Helpers for scripts that talk to the local Firebase emulators (project demo-vaultdoc).
// They never touch the live project: every URL below is 127.0.0.1.
export const PROJECT = "demo-vaultdoc";
export const PASSWORD = "pass-1234";
const AUTH = "http://127.0.0.1:9099";
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const ST = `http://127.0.0.1:9199/v0/b/${PROJECT}.appspot.com/o`;
const FN = `http://127.0.0.1:5001/${PROJECT}/asia-south2`;
const json = (r) => r.json();
const post = (url, body, headers = {}) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }).then(json);

/** Fails early with a clear message when the emulators aren't running. */
export async function requireEmulators() {
  try {
    await fetch(`${AUTH}/`);
    await fetch("http://127.0.0.1:8080/");
  } catch {
    console.error("The emulators aren't running. Start them first:  npm run emulators");
    process.exit(1);
  }
}

/** Logs in a test account, creating it (verified unless told otherwise) if it doesn't exist yet. */
export async function user(email, { verified = true } = {}) {
  let r = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=k`, { email, password: PASSWORD, returnSecureToken: true });
  let created = false;
  if (r.error) {
    const up = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=k`, { email, password: PASSWORD, displayName: email.split("@")[0], returnSecureToken: true });
    if (up.error) throw new Error(`Couldn't create ${email}: ${up.error.message}`);
    if (verified) await post(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, { localId: up.localId, emailVerified: true }, { Authorization: "Bearer owner" });
    r = await post(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=k`, { email, password: PASSWORD, returnSecureToken: true });
    created = true;
  }
  return { uid: r.localId, token: r.idToken, email, created };
}

// ---- Firestore (REST; "Bearer owner" is the emulator's admin access) ----
const toValue = (v) =>
  v === null || v === undefined
    ? { nullValue: null }
    : typeof v === "string"
      ? { stringValue: v }
      : typeof v === "boolean"
        ? { booleanValue: v }
        : Number.isInteger(v)
          ? { integerValue: String(v) }
          : typeof v === "number"
            ? { doubleValue: v }
            : Array.isArray(v)
              ? { arrayValue: { values: v.map(toValue) } }
              : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
const fromValue = (v) =>
  "integerValue" in v ? Number(v.integerValue) : "doubleValue" in v ? v.doubleValue : "stringValue" in v ? v.stringValue : "booleanValue" in v ? v.booleanValue
  : "arrayValue" in v ? (v.arrayValue.values ?? []).map(fromValue) : "mapValue" in v ? fromFields(v.mapValue.fields ?? {}) : null;
const fromFields = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, fromValue(v)]));

/** Reads a document as plain data (null if missing). */
export async function getDoc(path) {
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: "Bearer owner" } });
  if (r.status === 404) return null;
  return fromFields((await r.json()).fields ?? {});
}
/** Sets the given fields (merge). Fields given as `undefined` are deleted. */
export async function setFields(path, fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const kept = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toValue(v)]));
  const r = await fetch(`${FS}/${path}?${mask}`, { method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify({ fields: kept }) });
  if (!r.ok) throw new Error(`setFields ${path}: ${await r.text()}`);
}
export async function deleteDoc(path) {
  await fetch(`${FS}/${path}`, { method: "DELETE", headers: { Authorization: "Bearer owner" } });
}
/** Documents in a collection where `field == value` (ids and data). */
export async function where(collection, field, value) {
  const r = await post(
    `${FS}:runQuery`,
    { structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: toValue(value) } } } },
    { Authorization: "Bearer owner" },
  );
  return r.filter((x) => x.document).map((x) => ({ id: x.document.name.split("/").pop(), data: fromFields(x.document.fields ?? {}) }));
}

// ---- My Space files ----
/** Adds a file to a user's My Space the way the app does (item record, then the upload). */
export async function addFile(u, id, name, body, type = "application/pdf") {
  const fields = { kind: "file", name, nameLower: name.toLowerCase(), parentId: "root", ancestorIds: [], status: "uploading", size: body.length, storagePath: `users/${u.uid}/files/${id}`, contentType: type };
  const r = await fetch(`${FS}/users/${u.uid}/items?documentId=${id}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (!r.ok) throw new Error(`item ${id}: ${await r.text()}`);
  const up = await fetch(`${ST}?name=${encodeURIComponent(`users/${u.uid}/files/${id}`)}`, { method: "POST", headers: { Authorization: `Firebase ${u.token}`, "Content-Type": type }, body });
  if (!up.ok) throw new Error(`upload ${id}: ${await up.text()}`);
}

/** Calls a callable function as this user. Returns the result, or { error, msg, reason }. */
export async function call(name, data, u) {
  const r = await post(`${FN}/${name}`, { data }, u ? { Authorization: `Bearer ${u.token}` } : {});
  return r.error ? { error: r.error.status, msg: r.error.message, reason: r.error.details?.reason } : r.result;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** India date (yyyy-mm-dd), like the functions use for "today". */
export const istDay = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
