"use client";

import { useEffect } from "react";
import { preloadVideosWithLinks } from "@/lib/video/preload";

/**
 * On mount, injects preload link tags for video clips. Removes them on unmount.
 */
export function PreloadVideos() {
  useEffect(() => {
    const cleanup = preloadVideosWithLinks();
    return cleanup;
  }, []);
  return null;
}
