import type { ClipId } from "@/domain/conversation/types";
import { getClipSrc, PRELOAD_CLIPS } from "./clips";

/**
 * Preload a single video by setting an existing video element's src.
 * Caller should use a hidden video element or the standby buffer.
 */
export function preloadVideoInElement(
  element: HTMLVideoElement | null,
  clipId: ClipId
): void {
  if (!element) return;
  element.src = getClipSrc(clipId);
  element.load();
}

/**
 * Preload videos via link tags (for initial page load).
 * Returns a cleanup function that removes the links.
 */
export function preloadVideosWithLinks(clipIds: ClipId[] = PRELOAD_CLIPS): () => void {
  if (typeof document === "undefined") return () => {};

  const links: HTMLLinkElement[] = [];
  for (const id of clipIds) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.href = getClipSrc(id);
    document.head.appendChild(link);
    links.push(link);
  }

  return () => {
    for (const link of links) {
      link.remove();
    }
  };
}
