"use client";

import { useEffect } from "react";

/**
 * Requests microphone permission as soon as the component mounts (client-only).
 * Gets a short-lived audio stream and releases it immediately so the browser
 * shows the "Allow microphone?" prompt on load. When the user later clicks
 * "Start chat", the mic is already allowed and speech recognition starts without
 * a second prompt.
 */
export function useRequestMicOnLoad(): void {
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
      })
      .catch(() => {
        // Permission denied or unsupported; existing flow handles this when user clicks Start.
      });
  }, []);
}
