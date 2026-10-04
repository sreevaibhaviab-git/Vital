# VITAL — Visual Maintenance Copilot

VITAL is an AI-powered visual maintenance copilot that identifies equipment problems, guides safe inspections and creates structured maintenance reports.

## Phase 5 voice fix

The earlier continuous Gemini Live experiment has been replaced with a more dependable push-to-talk workflow:

1. Tap the microphone.
2. Speak for up to 12 seconds.
3. Tap the microphone again.
4. Gemini transcribes and understands the recording.
5. VITAL displays the transcript and replies aloud.

A microphone is now visible inside the live camera frame. The floating microphone orb uses the same system. Saying **“Hi VITAL”** produces a spoken greeting, and equipment descriptions are automatically copied into the inspection problem field.

## Included features

- Original whimsical VITAL landing-page interface
- Live webcam with front/rear camera switching
- Camera microphone with visible recording state
- Floating push-to-talk voice assistant
- Gallery image upload
- Equipment category and problem description
- Gemini visual analysis
- Structured safety report
- Safe-check and stop-condition guidance
- Follow-up text chat and spoken responses
- Responsive desktop and mobile design

## Environment setup

Create `.env` in the same folder as `package.json`:

```env
GEMINI_API_KEY=PASTE_YOUR_GEMINI_API_KEY_HERE
GEMINI_MODEL=gemini-2.5-flash
```

VITAL automatically retries `gemini-2.5-flash` if another configured model is unavailable.

## Run

```bash
npm install
npm run dev
```

Open the localhost address shown in Terminal. Camera and microphone access require localhost or HTTPS.

## Test the camera microphone

1. Open the project in Chrome.
2. Start Inspection.
3. Open Live Camera.
4. Tap the microphone inside the camera frame.
5. Allow microphone access.
6. Say “Hi VITAL”.
7. Tap the red microphone again.
8. Wait for the transcript and spoken reply.

## Safety

VITAL is an AI visual-inspection prototype, not a certified technician. It avoids dangerous repair guidance and directs users to qualified professionals for high-risk situations.
