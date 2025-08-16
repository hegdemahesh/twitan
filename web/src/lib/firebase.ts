import { initializeApp } from 'firebase/app'
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth'
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'

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

// Emulator wiring (optional): set VITE_USE_EMULATORS=true to use local emulators
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  // Functions emulator
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  // Auth emulator
  connectAuthEmulator(auth, 'http://127.0.0.1:9099')
}

export { RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged, httpsCallable }
