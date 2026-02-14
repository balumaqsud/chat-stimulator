"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { ClipId } from "@/domain/conversation/types";
import { getClipSrc } from "@/lib/video/clips";

type VisibleBuffer = "active" | "standby";

const HAVE_FUTURE_DATA = 2;

function waitUntilReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HAVE_FUTURE_DATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (e: Event) => {
      cleanup();
      reject(e);
    };
    const cleanup = () => {
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("canplaythrough", onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("canplaythrough", onReady, { once: true });
    video.addEventListener("canplay", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

export interface VideoStageProps {
  currentClip: ClipId;
  onEnded: () => void;
  isLooping: boolean;
  transitionKey?: string;
  onLoadError?: (clip: ClipId, error: unknown) => void;
  /** Called when a clip is swapped in and play() has resolved. Use to start speech when listening clip is ready. */
  onClipReady?: (clipId: ClipId) => void;
}

export function VideoStage({
  currentClip,
  onEnded,
  isLooping,
  transitionKey = "",
  onLoadError,
  onClipReady,
}: VideoStageProps) {
  const activeRef = useRef<HTMLVideoElement>(null);
  const standbyRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState<VisibleBuffer>("active");
  const displayedClipRef = useRef<ClipId | null>(null);
  const isSwitchingRef = useRef(false);

  const switchTo = useCallback(
    async (clip: ClipId) => {
      const active = activeRef.current;
      const standby = standbyRef.current;
      if (!active || !standby) return;

      const path = getClipSrc(clip);
      const src =
        typeof window !== "undefined"
          ? new URL(path, window.location.origin).href
          : path;

      if (displayedClipRef.current === clip && !isSwitchingRef.current) {
        const visibleEl = visible === "active" ? active : standby;
        if (visibleEl.src?.includes(clip) && visibleEl.paused) {
          visibleEl.play().catch(() => {});
        }
        return;
      }

      if (isSwitchingRef.current) return;
      isSwitchingRef.current = true;

      try {
        const loadTarget = visible === "active" ? standby : active;
        loadTarget.src = src;
        loadTarget.loop = isLooping;
        loadTarget.load();
        await waitUntilReady(loadTarget);
        await loadTarget.play();

        if (visible === "active") {
          setVisible("standby");
          active.pause();
          active.currentTime = 0;
        } else {
          setVisible("active");
          standby.pause();
          standby.currentTime = 0;
        }
        displayedClipRef.current = clip;
        onClipReady?.(clip);
      } catch (err) {
        onLoadError?.(clip, err);
      } finally {
        isSwitchingRef.current = false;
      }
    },
    [onLoadError, onClipReady, visible, isLooping],
  );

  useEffect(() => {
    switchTo(currentClip);
  }, [currentClip, transitionKey, switchTo]);

  // Attach ended handler to whichever element is visible; only for non-looping clips.
  useEffect(() => {
    const active = activeRef.current;
    const standby = standbyRef.current;
    if (!active || !standby) return;

    const handleEnded = () => {
      if (!isLooping) onEnded();
    };

    active.addEventListener("ended", handleEnded);
    standby.addEventListener("ended", handleEnded);
    return () => {
      active.removeEventListener("ended", handleEnded);
      standby.removeEventListener("ended", handleEnded);
    };
  }, [isLooping, onEnded]);

  // Initial load: show currentClip in active (visible)
  useEffect(() => {
    const active = activeRef.current;
    if (!active || displayedClipRef.current !== null) return;
    const path = getClipSrc(currentClip);
    const src =
      typeof window !== "undefined"
        ? new URL(path, window.location.origin).href
        : path;
    active.src = src;
    active.loop = isLooping;
    displayedClipRef.current = currentClip;
    active
      .play()
      .then(() => onClipReady?.(currentClip))
      .catch(() => {});
  }, []);

  return (
    <div className="relative w-full h-full min-h-[300px] bg-black overflow-hidden rounded-lg">
      <video
        ref={activeRef}
        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${
          visible === "active" ? "opacity-100" : "opacity-0"
        }`}
        playsInline
        preload="auto"
      />
      <video
        ref={standbyRef}
        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${
          visible === "standby" ? "opacity-100" : "opacity-0"
        }`}
        playsInline
        preload="auto"
      />
    </div>
  );
}
