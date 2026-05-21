import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup as fbSignInWithPopup, signOut as fbSignOut, onAuthStateChanged as fbOnAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, getDocFromServer, doc as fbDoc, getDoc as fbGetDoc, setDoc as fbSetDoc, addDoc as fbAddDoc, deleteDoc as fbDeleteDoc, collection as fbCollection, query as fbQuery, where as fbWhere, orderBy as fbOrderBy, onSnapshot as fbOnSnapshot, serverTimestamp as fbServerTimestamp } from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

// Sandboxed iframe-friendly storage memory mapping definitions
const memoryStore = new Map<string, string>();
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`[safeStorage] Security block reading key "${key}" inside sandboxed sandbox layout. Switching to memory mapping fallback.`, e);
    }
    return memoryStore.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`[safeStorage] Security block writing key "${key}" inside sandboxed sandbox layout. Swapping to memory fallback.`, e);
    }
    memoryStore.set(key, value);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('localstorage_update', { detail: { key, value } }));
    }
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[safeStorage] Security block deleting key "${key}" inside sandboxed sandbox layout. Swapping to memory fallback.`, e);
    }
    memoryStore.delete(key);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('localstorage_update', { detail: { key, value: null } }));
    }
  },
  clear(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.clear();
      }
    } catch (e) {
      console.warn('[safeStorage] Security block purging store inside sandboxed sandbox layout.', e);
    }
    memoryStore.clear();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('localstorage_update', { detail: { cleared: true } }));
    }
  }
};

const sessionMemoryStore = new Map<string, string>();
export const safeSessionStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return sessionStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`[safeSessionStorage] Security block reading key "${key}". Swapping to memory mapping fallback.`, e);
    }
    return sessionMemoryStore.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`[safeSessionStorage] Security block writing key "${key}". Swapping to memory mapping fallback.`, e);
    }
    sessionMemoryStore.set(key, value);
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`[safeSessionStorage] Security block deleting key "${key}". Swapping to memory mapping fallback.`, e);
    }
    sessionMemoryStore.delete(key);
  }
};

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
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Global error handler
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Resilience check. If config is empty, run in Offline Fallback Mode
export const isFirebaseConfigured = !!(firebaseConfig && firebaseConfig.apiKey);

let firebaseApp;
let firestoreDb: any = null;
let firebaseAuth: any = null;

if (isFirebaseConfigured) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    firebaseAuth = getAuth(firebaseApp);
    
    // Quick validation of connection as requested by SKILL.md
    const testConnection = async () => {
      try {
        await getDocFromServer(fbDoc(firestoreDb, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration: Client is offline.");
        }
      }
    };
    testConnection();
  } catch (err) {
    console.warn("Failed to initialize physical Firebase app, transitioning to offline fallback mode:", err);
  }
}

// Expose standard interfaces with fallback implementations for complete reliability
export const db = firestoreDb;
export const auth = firebaseAuth || {
  currentUser: null,
  onAuthStateChanged: (cb: any) => {
    // Mock user
    const mockUser = safeStorage.getItem('mock_user_profile');
    if (mockUser) {
      cb(JSON.parse(mockUser));
    } else {
      cb(null);
    }
    return () => {};
  }
};

export const googleProvider = new GoogleAuthProvider();

export const signInWithPopup = async (_authInstance: any, _providerInstance: any) => {
  if (isFirebaseConfigured && firebaseAuth) {
    return fbSignInWithPopup(firebaseAuth, googleProvider);
  } else {
    // Mock Google Sign-In
    const mockProfile = {
      uid: 'kWmKJf5l2GV9vkPUj0AqP3zorfh2',
      displayName: 'Pratham Suri',
      email: 'suripratham4@gmail.com',
      photoURL: 'https://lh3.googleusercontent.com/a/ACg8ocKW1dumleX6dEfk-XG9UEpcEZoXe1AmC06t0KQCWYjzx1fiiQ=s96-c',
      emailVerified: true,
      providerData: [{ providerId: 'google.com', email: 'suripratham4@gmail.com' }]
    };
    safeStorage.setItem('mock_user_profile', JSON.stringify(mockProfile));
    window.location.reload();
    return { user: mockProfile };
  }
};

export const signOut = async (_authInstance: any) => {
  if (isFirebaseConfigured && firebaseAuth) {
    return fbSignOut(firebaseAuth);
  } else {
    safeStorage.removeItem('mock_user_profile');
    window.location.reload();
  }
};

export const onAuthStateChanged = (authInstance: any, callback: any) => {
  if (isFirebaseConfigured && firebaseAuth) {
    return fbOnAuthStateChanged(firebaseAuth, callback);
  } else {
    const mockUser = safeStorage.getItem('mock_user_profile');
    callback(mockUser ? JSON.parse(mockUser) : null);
    return () => {};
  }
};

// Re-export firestore primitives safely (will use native if configured, otherwise fallback to local storage triggers)
export { doc, setDoc, getDoc, addDoc, deleteDoc, collection, query, where, orderBy, onSnapshot, serverTimestamp };

function doc(firestore: any, collectionPath: string, ...pathSegments: string[]) {
  if (isFirebaseConfigured && firestore) {
    return fbDoc(firestore, collectionPath, ...pathSegments);
  }
  return { path: `${collectionPath}/${pathSegments.join('/')}`, type: 'doc' };
}

function collection(firestore: any, collectionPath: string) {
  if (isFirebaseConfigured && firestore) {
    return fbCollection(firestore, collectionPath);
  }
  return { path: collectionPath, type: 'collection' };
}

async function setDoc(docRef: any, data: any) {
  if (isFirebaseConfigured && db) {
    return fbSetDoc(docRef, data);
  }
  // Local implementation
  safeStorage.setItem(`doc_${docRef.path}`, JSON.stringify(data));
}

async function getDoc(docRef: any) {
  if (isFirebaseConfigured && db) {
    return fbGetDoc(docRef);
  }
  const item = safeStorage.getItem(`doc_${docRef.path}`);
  return {
    exists: () => !!item,
    data: () => item ? JSON.parse(item) : null
  };
}

async function addDoc(collectionRef: any, data: any) {
  if (isFirebaseConfigured && db) {
    return fbAddDoc(collectionRef, data);
  }
  const idValue = Math.random().toString(36).substring(7);
  const fullPath = `${collectionRef.path}/${idValue}`;
  safeStorage.setItem(`doc_${fullPath}`, JSON.stringify({ ...data, id: idValue }));
  
  // Update sessions index if they are creating a new chat session to mock listing queries
  if (collectionRef.path === 'sessions') {
    const cachedSessions = JSON.parse(safeStorage.getItem('local_sessions_list') || '[]');
    cachedSessions.push({ id: idValue, ...data });
    safeStorage.setItem('local_sessions_list', JSON.stringify(cachedSessions));
  }
  
  // Store messages local storage subcollection mock
  if (collectionRef.path.includes('/messages')) {
    const cachedMessages = JSON.parse(safeStorage.getItem(`local_msg_${collectionRef.path}`) || '[]');
    cachedMessages.push({ id: idValue, ...data });
    safeStorage.setItem(`local_msg_${collectionRef.path}`, JSON.stringify(cachedMessages));
  }

  return { id: idValue, path: fullPath };
}

async function deleteDoc(docRef: any) {
  if (isFirebaseConfigured && db) {
    return fbDeleteDoc(docRef);
  }
  safeStorage.removeItem(`doc_${docRef.path}`);
  if (docRef.path.startsWith('sessions/')) {
    const id = docRef.path.split('/')[1];
    const cachedSessions = JSON.parse(safeStorage.getItem('local_sessions_list') || '[]');
    const filtered = cachedSessions.filter((s: any) => s.id !== id);
    safeStorage.setItem('local_sessions_list', JSON.stringify(filtered));
    safeStorage.removeItem(`local_msg_sessions/${id}/messages`);
  }
}

function query(collectionRef: any, ...queryConstraints: any[]) {
  return { collectionRef, queryConstraints, type: 'query' };
}

function where(fieldPath: string, opStr: string, value: any) {
  return { type: 'where', fieldPath, opStr, value };
}

function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

function onSnapshot(ref: any, onNext: (snapshot: any) => void, onError?: (error: any) => void) {
  if (isFirebaseConfigured && db) {
    // Normal snap listener
    return fbOnSnapshot(ref, onNext, onError);
  }

  // Local Storage listener mock
  let lastDataStr = "";

  const runUpdate = () => {
    let rawData = "";
    let docsList: any[] = [];
    const targetRef = ref.type === 'query' ? ref.collectionRef : ref;

    if (targetRef.path === 'sessions') {
      rawData = safeStorage.getItem('local_sessions_list') || '[]';
      if (rawData === lastDataStr) return;
      lastDataStr = rawData;
      
      const stored = JSON.parse(rawData);
      docsList = stored.map((s: any) => ({
        id: s.id,
        data: () => s
      }));
    } else if (targetRef.path.includes('/messages')) {
      rawData = safeStorage.getItem(`local_msg_${targetRef.path}`) || '[]';
      if (rawData === lastDataStr) return;
      lastDataStr = rawData;
      
      const stored = JSON.parse(rawData);
      docsList = stored.map((m: any) => ({
        id: m.id,
        data: () => m
      }));
    } else {
      return;
    }

    onNext({
      docs: docsList,
      forEach: (cb: any) => docsList.forEach(cb)
    });
  };

  // Run once immediately to fetch current state
  runUpdate();

  // Listen for local tab events for direct, instant, non-polling reactivity
  if (typeof window !== 'undefined') {
    window.addEventListener('localstorage_update', runUpdate);
    window.addEventListener('storage', runUpdate);
  }

  // Polling fallback at a slower interval (3000ms) to conserve CPU
  const interval = setInterval(runUpdate, 3000);

  return () => {
    clearInterval(interval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('localstorage_update', runUpdate);
      window.removeEventListener('storage', runUpdate);
    }
  };
}

function serverTimestamp() {
  if (isFirebaseConfigured && db) {
    return fbServerTimestamp();
  }
  return Date.now();
}
