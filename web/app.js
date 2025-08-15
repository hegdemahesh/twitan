// Firebase client (modular v10) via ESM CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-functions.js";

// Firebase config for twitan-da6d8 (provided)
const firebaseConfig = {
  apiKey: "AIzaSyAU5j30CmkE8dahxhBzNodbijZuIM5HUw0",
  authDomain: "twitan-da6d8.firebaseapp.com",
  projectId: "twitan-da6d8",
  storageBucket: "twitan-da6d8.firebasestorage.app",
  messagingSenderId: "334120091220",
  appId: "1:334120091220:web:55317aa7040b8bd0aff7c1",
  measurementId: "G-KPBR8XMNPQ",
};

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Gen 1 function is in us-central1
const functions = getFunctions(app, "us-central1");

// UI elements
const loginSection = document.getElementById("loginSection");
const homeSection = document.getElementById("homeSection");
const nav = document.getElementById("nav");
const userPhoneSpan = document.getElementById("userPhone");
const logoutBtn = document.getElementById("logoutBtn");

const phoneInput = document.getElementById("phoneInput");
const sendCodeBtn = document.getElementById("sendCodeBtn");
const codeBlock = document.getElementById("codeBlock");
const codeInput = document.getElementById("codeInput");
const verifyCodeBtn = document.getElementById("verifyCodeBtn");
const loginMsg = document.getElementById("loginMsg");

const createTournamentBtn = document.getElementById("createTournamentBtn");
const createTournamentDialog = document.getElementById("createTournamentDialog");
const tournamentForm = document.getElementById("tournamentForm");
const tournamentNameInput = document.getElementById("tournamentName");
const dialogMsg = document.getElementById("dialogMsg");
const resultDiv = document.getElementById("result");

let confirmationResultGlobal = null;

// Helpers
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
function setMsg(el, text, isError = false) {
  el.textContent = text;
  el.style.color = isError ? "#c00" : "#0b5";
}

// Setup RecaptchaVerifier (visible)
let recaptchaVerifier = null;
function ensureRecaptcha() {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "normal",
    });
    recaptchaVerifier.render();
  }
}

sendCodeBtn.addEventListener("click", async () => {
  try {
    ensureRecaptcha();
    const phoneNumber = phoneInput.value.trim();
    if (!phoneNumber) { setMsg(loginMsg, "Enter phone number in E.164 format.", true); return; }
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    confirmationResultGlobal = confirmationResult;
    show(codeBlock);
    setMsg(loginMsg, "SMS code sent. Check your phone.");
  } catch (err) {
    console.error(err);
    setMsg(loginMsg, err.message || String(err), true);
  }
});

verifyCodeBtn.addEventListener("click", async () => {
  try {
    const code = codeInput.value.trim();
    if (!code) { setMsg(loginMsg, "Enter the 6-digit code.", true); return; }
    const cred = await confirmationResultGlobal.confirm(code);
    setMsg(loginMsg, `Logged in as ${cred.user.phoneNumber}`);
  } catch (err) {
    console.error(err);
    setMsg(loginMsg, err.message || String(err), true);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    userPhoneSpan.textContent = user.phoneNumber || "(phone)";
    hide(loginSection);
    show(homeSection);
    show(nav);
  } else {
    show(loginSection);
    hide(homeSection);
    hide(nav);
    resultDiv.textContent = "";
  }
});

// Open dialog
createTournamentBtn.addEventListener("click", () => {
  dialogMsg.textContent = "";
  tournamentForm.reset();
  if (typeof createTournamentDialog.showModal === "function") {
    createTournamentDialog.showModal();
  } else {
    // Fallback if dialog not supported
    show(createTournamentDialog);
  }
});

// Handle dialog submit
const callAddEvent = httpsCallable(functions, "addEvent");

tournamentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  dialogMsg.textContent = "";
  const name = tournamentNameInput.value.trim();
  if (!name) { setMsg(dialogMsg, "Please enter a tournament name.", true); return; }
  try {
    // Build event payload
    const payload = {
      eventType: "tournament",
      eventName: "createBadmintonTournament",
      eventPayload: {
        type: "Badminton",
        name,
        // Add more fields later as needed
      },
    };
    // Call the callable function
    const res = await callAddEvent(payload);

    // Close dialog
    if (typeof createTournamentDialog.close === "function") createTournamentDialog.close();

    setMsg(resultDiv, `Tournament queued. Event ID: ${res.data.id}`);
  } catch (err) {
    console.error(err);
    setMsg(dialogMsg, err.message || String(err), true);
  }
});
