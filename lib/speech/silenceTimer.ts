/**
 * Timer-based silence detection: no audio processing.
 * Start when entering LISTENING; reset on interim results.
 * At SILENCE_MS: callback (play "Are you still there?" prompt).
 * If triggered again: callback with secondSilence true. The app intentionally
 * does not use secondSilence for GOODBYE; it loops listen→prompt→listen instead.
 */

const SILENCE_MS = 9000;
const DEFAULT_MAX_SILENCE_COUNT = 2;

export interface SilenceTimerCallbacks {
  onSilence: (secondSilence: boolean) => void;
}

export interface SilenceTimer {
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function createSilenceTimer(
  callbacks: SilenceTimerCallbacks,
  maxSilenceCount: number = DEFAULT_MAX_SILENCE_COUNT
): SilenceTimer {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let silenceCount = 0;

  function clear() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function schedule() {
    clear();
    timeoutId = setTimeout(() => {
      timeoutId = null;
      silenceCount += 1;
      callbacks.onSilence(silenceCount >= maxSilenceCount);
    }, SILENCE_MS);
  }

  return {
    start() {
      silenceCount = 0;
      schedule();
    },
    stop() {
      clear();
      silenceCount = 0;
    },
    reset() {
      schedule();
    },
  };
}
