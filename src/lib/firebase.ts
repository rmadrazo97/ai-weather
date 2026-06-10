// ---------------------------------------------------------------------------
// Firebase client setup: app init, anonymous auth (AsyncStorage persistence),
// callable functions (us-central1), optional local emulators.
// ---------------------------------------------------------------------------

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import {
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  signInAnonymously,
  type Auth,
  type Persistence,
} from 'firebase/auth';

// `getReactNativePersistence` exists at runtime under React Native: Metro
// resolves 'firebase/auth' -> '@firebase/auth' with the "react-native" exports
// condition (dist/rn/index.js exports it). The TypeScript entry point for
// 'firebase/auth' is the browser build, which does not declare it, hence the
// typed cast (the standard firebase JS SDK + RN workaround as of v12).
const getReactNativePersistence = (
  firebaseAuth as unknown as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
  }
).getReactNativePersistence;
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions';

// ---------------------------------------------------------------------------
// Config (public client identifiers — safe to ship)
// ---------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// ---------------------------------------------------------------------------
// Auth — anonymous, persisted in AsyncStorage
// ---------------------------------------------------------------------------

// initializeAuth throws if the Auth component was already initialized for this
// app (e.g. Fast Refresh re-evaluating this module); fall back to the existing
// instance in that case. On web (where the RN persistence helper doesn't
// exist) fall back to the platform default via getAuth.
let authInstance: Auth;
try {
  authInstance = getReactNativePersistence
    ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
    : getAuth(app);
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;

/** Signs in anonymously if there is no current user. Rethrows with context. */
export async function ensureSignedIn(): Promise<void> {
  if (auth.currentUser) return;
  try {
    await signInAnonymously(auth);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`weatherChat: anonymous sign-in failed (${reason})`);
  }
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export const functions = getFunctions(app, 'us-central1');

if (__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATOR === '1') {
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  connectFunctionsEmulator(functions, host, 5001);
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
}

// ---------------------------------------------------------------------------
// weatherChat callable contract
// ---------------------------------------------------------------------------

export interface ChatTurn {
  role: 'user' | 'assistant';
  /** ≤1000 chars */
  text: string;
}

export interface WeatherChatContext {
  /** ≤80 chars */
  location: string;
  lat: number;
  lon: number;
  unit: 'C' | 'F';
  /** ≤40 chars */
  localTime: string;
  /** ≤1500 chars */
  weatherSummary: string;
}

export interface WeatherChatRequest {
  /** 1..10 turns; last entry is the new user turn. */
  messages: ChatTurn[];
  context: WeatherChatContext;
}

export interface WeatherChatChunk {
  delta: string;
}

export interface WeatherChatResponse {
  text: string;
}

export const weatherChatCallable = httpsCallable<
  WeatherChatRequest,
  WeatherChatResponse,
  WeatherChatChunk
>(functions, 'weatherChat');
