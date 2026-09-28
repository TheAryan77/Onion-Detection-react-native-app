# Onion Grader (SIH PS 26031)

AI-assisted onion grading: photo → onion count, defects (cut / rotten / sprouted), size from a printed
ArUco marker → Grade A / URS / Reject per onion → lot verdict → shareable PDF report.

Full design, API contract and photography protocol: `ONION_GRADER_SOLUTION.md` (the build spec).

```
backend/   FastAPI + OpenCV + Roboflow hosted model (onions-ciqkj/3). Holds the API key.
mobile/    Expo SDK 57 app (expo-router). Runs in Expo Go, talks only to the backend.
```

## Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # paste ROBOFLOW_API_KEY, or set MOCK_MODE=true
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pytest                          # grading rules + segmentation tests
```

- `http://localhost:8000/docs` lets you try `/analyze` from the browser.
- `MOCK_MODE=true` puts fake defects on real segmented onions (no Roboflow credits used).
- `backend/marker_50mm.png`: print at 100 % (not "fit to page"), measure the black square, enter it in the app's Settings.
- `backend/samples/synthetic_batch.jpg`: 14 synthetic onions + marker, for a quick smoke test:
  `curl -F file=@samples/synthetic_batch.jpg http://localhost:8000/analyze`
- Assistant chat bubble: put a Google AI Studio key in `GEMINI_API_KEY` in `backend/.env` (optional `GEMINI_MODEL`)
  and restart the backend. The app calls `POST /chat`; the key never reaches the phone.
- Grade thresholds live only in `app/grading_rules.json` (placeholders: replace with the spec you cite).

## Mobile

```bash
cd mobile
npm install
npx expo start                  # scan the QR code with Expo Go on the Android phone
```

Set `EXPO_PUBLIC_API_URL` in `mobile/.env` to the Mac's LAN IP (`ipconfig getifaddr en0`), or change it
in the app's Settings. For a different network use `npx expo start --tunnel` and
`cloudflared tunnel --url http://localhost:8000`. APK: `eas build -p android --profile preview` (needs an HTTPS backend URL in `eas.json`).

## Where this differs from the spec

- **Expo SDK 57 layout:** screens are in `mobile/src/app/` and `@/*` maps to `mobile/src/*`, so imports are `@/types`, `@/lib/...`.
- **Image resize:** `manipulateAsync` is deprecated in SDK 57; `src/lib/image.ts` uses `ImageManipulator.manipulate().renderAsync()`.
- **RN 0.86:** `StyleSheet.absoluteFillObject` was removed; `scan.tsx` uses `StyleSheet.absoluteFill`.
- **Touching onions:** the watershed split in `segmentation.py` now triggers at solidity < 0.95 (was 0.88), tries peak
  thresholds 0.55 → 0.7 → 0.8, and rejects splits where any part is < 20 % of the blob (so a sprout isn't counted as an onion).
  The spec's version merged two touching onions into one.
