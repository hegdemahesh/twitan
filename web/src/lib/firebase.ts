import { initializeApp } from 'firebase/app'
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth'
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

// Config provided by user
export const firebaseConfig = {
  apiKey: "AIzaSyAU5j30CmkE8dahxhBzNodbijZuIM5HUw0",
  authDomain: "twitan-da6d8.firebaseapp.com",
  projectId: "twitan-da6d8",
  storageBucket: "twitan-da6d8.firebasestorage.app",
  messagingSenderId: "334120091220",
  appId: "1:334120091220:web:55317aa7040b8bd0aff7c1",
  measurementId: "G-KPBR8XMNPQ"
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const functions = getFunctions(app, 'us-central1')
export const db = getFirestore(app)
export const storage = getStorage(app)

// Decide emulator usage: explicit env or default on localhost
export const isEmulator =
  import.meta.env.VITE_USE_EMULATORS === 'true' ||
  ['localhost', '127.0.0.1'].includes(window.location.hostname)

if (isEmulator) {
  // For Phone Auth on web, bypass real app verification when using the emulator
  // This avoids Recaptcha during local development
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  auth.settings.appVerificationDisabledForTesting = true

  // Functions emulator
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  // Firestore emulator
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  // Storage emulator
  connectStorageEmulator(storage, '127.0.0.1', 9199)
  // Auth emulator
  connectAuthEmulator(auth, 'http://127.0.0.1:9099')
}

export { RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged, httpsCallable }
