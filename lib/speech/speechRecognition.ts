/**
 * Wrapper around Web Speech API (SpeechRecognition).
 * Handles feature detection, start/stop guards, and event exposure.
 */

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
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

export interface SpeechRecognitionCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export interface SpeechRecognitionWrapper {
  start: () => void;
  stop: () => void;
  isSupported: () => boolean;
}

export function createSpeechRecognition(
  callbacks: SpeechRecognitionCallbacks
): SpeechRecognitionWrapper {
  let recognition: InstanceType<SpeechRecognitionCtor> | null = null;
  let started = false;

  function isSupported(): boolean {
    return isSpeechRecognitionSupported();
  }

  function start(): void {
    if (!SpeechRecognitionAPI) {
      callbacks.onError("Speech recognition is not supported");
      return;
    }
    if (started) return;

    try {
      recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: { results: { length: number; [i: number]: { 0: { transcript: string }; isFinal: boolean } } }) => {
        const last = event.results[event.results.length - 1];
        if (!last) return;
        const transcript = (last[0] as { transcript?: string } | undefined)?.transcript ?? "";
        const isFinal = last.isFinal;
        callbacks.onResult(transcript, isFinal);
      };

      recognition.onerror = (event: { error: string }) => {
        const message =
          event.error === "not-allowed"
            ? "Microphone permission denied"
            : event.error === "no-speech"
              ? "No speech heard"
              : `Speech error: ${event.error}`;
        callbacks.onError(message);
      };

      recognition.onend = () => {
        started = false;
        callbacks.onEnd();
      };

      recognition.start();
      started = true;
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

  return { start, stop, isSupported };
}
