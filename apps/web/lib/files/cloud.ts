import {
  connectFirestoreEmulator,
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { connectStorageEmulator, FirebaseStorage, getStorage } from "firebase/storage";
import { startAppCheck } from "../appCheck";
import app, { USE_EMULATORS } from "../firebase";

/**
 * Firestore and Storage are set up lazily, only on pages that use them, so
 * the landing page doesn't download them.
 */
let firestore: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export function db(): Firestore {
  if (!firestore) {
    startAppCheck();
    try {
      // Cache in IndexedDB so folders you've opened before show instantly, across tabs
      firestore = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      // Already initialised (hot reload)
      firestore = getFirestore(app);
    }
    if (USE_EMULATORS) {
      try {
        connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
      } catch {
        // already connected
      }
    }
  }
  return firestore;
}

export function bucket(): FirebaseStorage {
  if (!storage) {
    startAppCheck();
    storage = getStorage(app);
    if (USE_EMULATORS) connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  return storage;
}
