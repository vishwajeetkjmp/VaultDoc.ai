import { getApps, initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

// Imported first by every functions module, so these apply before any function is defined.
if (!getApps().length) initializeApp();

// Same region as the Firestore database and Storage bucket (Delhi)
setGlobalOptions({ region: "asia-south2", maxInstances: 10 });
