/**
 * Thin wrapper around Web Speech API (SpeechRecognition).
 * Handles feature detection, start/stop/abort guards, and normalized callbacks.
 * No conversation logic; controller decides when to start/stop.
 */

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: { results: { length: number; [i: number]: { 0: { transcript: string }; isFinal: boolean } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const SpeechRecognitionAPI: SpeechRecognitionCtor | undefined =
  typeof window !== "undefined"
    ? (window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition)
    : undefined;

export function isSpeechRecognitionSupported(): boolean {
  return !!SpeechRecognitionAPI;
}

export interface SpeechRecognizerCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface SpeechRecognizer {
  start: () => void;
  stop: () => void;
  abort: () => void;
  isSupported: () => boolean;
  setLang: (lang: string) => void;
}

const DEFAULT_LANG = "en-US";

export function createSpeechRecognizer(
  callbacks: SpeechRecognizerCallbacks
): SpeechRecognizer {
  let recognition: InstanceType<SpeechRecognitionCtor> | null = null;
  let started = false;
  let aborted = false;
  let lang = DEFAULT_LANG;

  function isSupported(): boolean {
    return isSpeechRecognitionSupported();
  }

  function setLang(newLang: string): void {
    lang = newLang;
    if (recognition) recognition.lang = lang;
  }

  function start(): void {
    if (!SpeechRecognitionAPI) {
      callbacks.onError("Speech recognition is not supported");
      return;
    }
    if (started) return;

    aborted = false;
    try {
      recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onresult = (event: { results: { length: number; [i: number]: { 0: { transcript: string }; isFinal: boolean } } }) => {
        const last = event.results[event.results.length - 1];
        if (!last) return;
        const transcript = (last[0] as { transcript?: string } | undefined)?.transcript ?? "";
        if (last.isFinal) {
          callbacks.onFinal(transcript);
        } else {
          callbacks.onInterim(transcript);
        }
      };

      recognition.onerror = (event: { error: string }) => {
        const message =
          event.error === "not-allowed"
            ? "Microphone permission denied"
            : event.error === "no-speech"
              ? "No speech heard"
              : event.error === "no-match"
                ? "Speech not recognized"
                : `Speech error: ${event.error}`;
        callbacks.onError(message);
      };

      recognition.onend = () => {
        started = false;
        callbacks.onEnd?.();
      };

      recognition.start();
      started = true;
      callbacks.onStart?.();
    } catch (err) {
      started = false;
      callbacks.onError(
        err instanceof Error ? err.message : "Failed to start recognition"
      );
    }
  }

  function stop(): void {
    if (!recognition || !started) return;
    try {
      recognition.stop();
    } catch {
      // ignore
    }
    started = false;
  }

  function abort(): void {
    aborted = true;
    if (!recognition || !started) return;
    try {
      if (typeof recognition.abort === "function") {
        recognition.abort();
      } else {
        recognition.stop();
      }
    } catch {
      // ignore
    }
    started = false;
  }

  return { start, stop, abort, isSupported, setLang };
}
