import { initializeApp } from "firebase-admin/app";

// Initialize Admin SDK once
initializeApp();

// Export callables
export { addEvent } from "./callables/addEvent";

// Export triggers
export { onEventQueued } from "./triggers/eventQueue";
