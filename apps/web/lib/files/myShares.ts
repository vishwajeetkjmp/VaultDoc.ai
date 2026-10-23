import { collection, onSnapshot, query, Timestamp, where } from "firebase/firestore";
import { db } from "./cloud";
import type { MyShare } from "./shares";

const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

/** Live list of the user's own shares ("Shared by me", and the shared icon on rows). */
export function listenMyShares(uid: string, onChange: (shares: MyShare[]) => void, onError?: () => void) {
  return onSnapshot(
    query(collection(db(), "shares"), where("ownerUid", "==", uid)),
    (snap) =>
      onChange(
        snap.docs
          .map((d) => {
            const x = d.data();
            return {
              linkId: d.id,
              itemId: x.itemId,
              itemKind: x.itemKind,
              itemName: x.itemName,
              mode: x.mode,
              invitees: x.invitees ?? [],
              expiresAt: toDate(x.expiresAt),
              views: x.views ?? 0,
              downloads: x.downloads ?? 0,
              lastOpenedAt: toDate(x.lastOpenedAt),
              createdAt: toDate(x.createdAt),
            } as MyShare;
          })
          .sort((a, b) => (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now())),
      ),
    () => onError?.(),
  );
}
