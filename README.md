# twitan Firebase Functions

This folder hosts Firebase Cloud Functions for the `twitan` project.

## addEvent (HTTPS Callable)
Adds a document to the Firestore collection `eventQue` with fields: `eventType`, `eventName`, `eventPayload`, `status`, `createdAt`, `callerUid`.

## Deploy
Use `npm run deploy` from the `functions` folder after logging in to Firebase CLI and selecting the `twitan` project.
