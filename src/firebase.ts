import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Suppress internal Firestore connection warnings during offline/retry periods
setLogLevel('silent');

const app = initializeApp(firebaseConfig);

// Initialize Firestore with multi-tab offline persistence enabled and robust long-polling for iframe/proxy environments
let dbInstance;
try {
  dbInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
      experimentalForceLongPolling: true
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

// CRITICAL: The app will break without firebaseConfig.firestoreDatabaseId
export const db = dbInstance;
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = (error as { code?: string })?.code;
  
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };

  // If network is offline or temporarily unavailable, do not treat as fatal
  if (
    errorCode === 'unavailable' ||
    errorMessage.includes('offline') ||
    errorMessage.includes('unavailable') ||
    errorMessage.includes('Could not reach Cloud Firestore')
  ) {
    console.info('Firestore network operation pending/offline:', path);
    return errInfo;
  }

  // If permission denied, log detailed diagnosis info
  if (errorCode === 'permission-denied' || errorMessage.includes('Missing or insufficient permissions')) {
    console.error('Firestore Permission Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  console.warn('Firestore Operation Notification: ', JSON.stringify(errInfo));
  return errInfo;
}

// Validate Connection to Firestore on boot as per Firebase specification
export async function testFirestoreConnection() {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.info('Client is currently operating in offline mode.');
    }
  }
}

// Test connection on boot
testFirestoreConnection().catch(() => {});

