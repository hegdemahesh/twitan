# Twitan Web (Phone Auth + Create Tournament)

Simple web app that lets users log in with phone number, then queue a Badminton tournament creation by calling the `addEvent` Firebase Callable Function.

## Prereqs
- Firebase project: `twitan-da6d8` (already set up)
- Ensure Authentication > Sign-in method > Phone provider is enabled.
- Ensure your dev domain is authorized in Firebase Console (localhost is allowed by default).

## Run locally
Use any static server (phone auth requires https or localhost; do not open index.html via file://).

- Option A: VS Code Live Server extension
- Option B: Node one-liner

```powershell
# From repo root
Set-Location -Path .\web
npx serve -l 5173 .
```

Then open http://localhost:5173 and log in with a test phone.

## Flow
1. Login with phone (reCAPTCHA will appear).
2. After login, click "Create a new tournament".
3. Enter a tournament name and submit.
4. The app calls `addEvent` (region us-central1) with:
   - eventType: "tournament"
   - eventName: "createBadmintonTournament"
   - eventPayload: `{ type: 'Badminton', name }`
5. Check Firestore collection `eventQue` for the new document.

## Notes
- Callable function must be deployed in `us-central1` and named `addEvent` (already in `functions/src/index.ts`).
- Later we can add Firestore triggers to process `eventQue` and create collections for tournaments.
