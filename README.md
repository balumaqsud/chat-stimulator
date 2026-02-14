# Chat Stimulator

A video-based conversation flow driven by speech recognition. Uses a double-buffer video strategy to avoid black flash when switching clips, and a strict state machine for transitions.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech

- **Next.js** (App Router), **TypeScript**, **Tailwind CSS**
- No backend; everything runs in the browser (Web Speech API, HTML5 video)

## Video strategy (no black flash)

- **Double buffer**: Two `<video>` elements (active + standby). The visible one plays; the other preloads the next clip.
- **Switch sequence**: Set standby `src` → wait until `readyState >= HAVE_FUTURE_DATA` or `canplaythrough` → start standby playback → swap visibility (opacity) → pause and reset the previous active so it becomes the next standby.
- **Preloading**: On load, `<link rel="preload" as="video">` (and optional programmatic preload) for idle, greeting, listening, response clips, goodbye, fallback, prompt.
- **Why it works**: The UI never shows a video until it’s already buffered and producing frames, so there’s no blank frame on transition.

## Speech strategy

- **Web Speech API**: Wrapper in `lib/speech/speechRecognition.ts` (feature detect, start/stop guards, `onResult`, `onError`, `onEnd`).
- **Lifecycle**: Mic starts only when state is `LISTENING`; stops when leaving LISTENING, on final result, or on error/permission denied.
- **Keyword rules** (in `domain/conversation/keywords.ts`): Normalize (lowercase, trim). Then: “goodbye”/“bye” → goodbye clip; “hello”/“hi” → general response; “weather”/“today” → weather; else → general; empty/error → fallback.
- **Fallbacks**: Speech error or no-speech → play fallback clip and resume listening; mic permission denied → show message and keep LISTENING video (mic off).

## Implemented vs stretch

- **Implemented**: Domain state machine, double-buffer VideoStage, preload, Web Speech wrapper, keyword mapping, transcript, mic indicator, controls, error handling (video load, permission, unsupported), silence timer (8–9 s prompt, then goodbye on second silence), debug panel (state, last keyword, simulate video ended).
- **Stretch**: Optional typed-input fallback when mic is denied or unsupported; `requestVideoFrameCallback` for swap-after-frame if needed.

## Known limitations

- **Web Speech**: Best support in Chrome and Edge; Safari has limited or no support — the UI shows “Mic: unsupported” and suggests Chrome/Edge.
- **Mobile**: Autoplay and some codecs may behave differently; videos are muted by default for autoplay policy.
- **Videos**: Place your clips in `public/video_files/`: `idle.mp4`, `greeting.mp4`, `listening.mp4`, `weather.mp4`, `general_response.mp4`, `goodbye.mp4`, `fallback.mp4`, `prompt.mp4`.

## Project structure

- `app/` — layout, page shell, globals
- `components/` — VideoStage (double-buffer), Controls, MicIndicator, Transcript, DebugPanel
- `domain/conversation/` — types, states, reducer (pure), keywords
- `lib/speech/` — speechRecognition wrapper, silenceTimer
- `lib/video/` — clips (clipId → URL), preload
- `hooks/` — useConversationController (reducer + effects + speech + silence)
