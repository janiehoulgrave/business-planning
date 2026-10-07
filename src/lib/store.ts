import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut as fbSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { ALLOWED_DOMAIN, FIRESTORE_COLLECTION } from '../config';
import { firebaseConfig } from '../firebase-config';
import { SavedState } from './types';

export interface Agent {
  uid: string;
  name: string;
  email: string;
  photo?: string | null;
}

export const cloudEnabled =
  !import.meta.env.VITE_PREVIEW && !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('PASTE');

const app = cloudEnabled ? initializeApp(firebaseConfig, 'business-planning') : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

const LOCAL_KEY = (uid: string) => `bps_${uid}`;
const LOCAL_AGENT = 'bps_local_agent';

export const isAllowedEmail = (email: string) => email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);

const toAgent = (u: User): Agent => ({
  uid: u.uid,
  name: u.displayName || u.email?.split('@')[0] || '',
  email: u.email || '',
  photo: u.photoURL,
});

// Calls back with the signed-in agent, or null.
export const watchAgent = (cb: (a: Agent | null) => void) => {
  if (!auth) {
    try {
      const raw = localStorage.getItem(LOCAL_AGENT);
      cb(raw ? JSON.parse(raw) : null);
    } catch {
      cb(null);
    }
    return () => {};
  }
  return onAuthStateChanged(auth, (u) => {
    if (u && u.email && isAllowedEmail(u.email)) cb(toAgent(u));
    else {
      if (u) fbSignOut(auth);
      cb(null);
    }
  });
};

export const signInWithGoogle = async (): Promise<Agent> => {
  if (!auth) throw new Error('Sign-in is not set up yet.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: ALLOWED_DOMAIN, prompt: 'select_account' });
  const res = await signInWithPopup(auth, provider);
  if (!res.user.email || !isAllowedEmail(res.user.email)) {
    await fbSignOut(auth);
    throw new Error(`Sign in with your @${ALLOWED_DOMAIN} account.`);
  }
  return toAgent(res.user);
};

// Permission to create files in the agent's Google Drive. drive.file only covers files
// this app creates; it cannot see anything else in their Drive. Asked for on first use.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
let driveToken: { token: string; at: number } | null = null;

export const getDriveToken = async (): Promise<string> => {
  if (!auth?.currentUser) throw new Error('not_signed_in');
  if (driveToken && Date.now() - driveToken.at < 50 * 60 * 1000) return driveToken.token;
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  provider.setCustomParameters({ hd: ALLOWED_DOMAIN, login_hint: auth.currentUser.email || '' });
  const res = await reauthenticateWithPopup(auth.currentUser, provider);
  const token = GoogleAuthProvider.credentialFromResult(res)?.accessToken;
  if (!token) throw new Error('no_token');
  driveToken = { token, at: Date.now() };
  return token;
};

export const forgetDriveToken = () => {
  driveToken = null;
};

// Local mode only: no sign-in, so the typed name and email identify the agent.
export const signInLocal = (name: string, email: string): Agent => {
  const agent = { uid: email.toLowerCase(), name, email };
  try {
    localStorage.setItem(LOCAL_AGENT, JSON.stringify(agent));
  } catch {
    /* storage blocked; this session still works */
  }
  return agent;
};

const safeRemove = (k: string) => {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
};

export const signOut = async () => {
  safeRemove(LOCAL_AGENT);
  if (auth) await fbSignOut(auth);
};

const readLocal = (uid: string): SavedState | null => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeLocal = (uid: string, state: SavedState) => {
  try {
    localStorage.setItem(LOCAL_KEY(uid), JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    /* storage full or blocked; the cloud copy still saves */
  }
};

// Loads saved progress. The cloud copy wins; the browser copy is a fallback.
export const loadProgress = async (agent: Agent): Promise<SavedState | null> => {
  const local = readLocal(agent.uid);
  if (!db) return local;
  try {
    const snap = await getDoc(doc(db, FIRESTORE_COLLECTION, agent.uid));
    if (snap.exists()) {
      const data = snap.data();
      return JSON.parse(data.state) as SavedState;
    }
  } catch (e) {
    console.warn('Could not load cloud progress, using this browser copy', e);
  }
  return local;
};

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline';

export const saveProgress = async (agent: Agent, state: SavedState): Promise<SaveStatus> => {
  writeLocal(agent.uid, state);
  if (!db) return 'saved';
  try {
    await setDoc(
      doc(db, FIRESTORE_COLLECTION, agent.uid),
      {
        email: agent.email,
        name: agent.name,
        // Stored as one string so the document shape stays simple and small.
        state: JSON.stringify(state),
        dealCount: state.deals.filter((d) => !d.excluded).length,
        submittedAt: state.submittedAt ?? null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return 'saved';
  } catch (e) {
    console.warn('Cloud save failed; progress is still saved in this browser', e);
    return 'offline';
  }
};

export const clearProgress = async (agent: Agent) => {
  safeRemove(LOCAL_KEY(agent.uid));
  if (!db) return;
  try {
    await setDoc(doc(db, FIRESTORE_COLLECTION, agent.uid), { state: null, submittedAt: null, updatedAt: serverTimestamp() }, { merge: true });
  } catch {
    /* ignore */
  }
};
