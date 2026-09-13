"use client";
import { useEffect } from "react";

export function ViewBeacon({ spaceId }: { spaceId: string }) {
  useEffect(() => {
    const body = JSON.stringify({ spaceId, referrer: document.referrer || null });
    try {
      const sent = navigator.sendBeacon?.("/api/spaces/view", new Blob([body], { type: "application/json" }));
      if (!sent) void fetch("/api/spaces/view", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    } catch {}
  }, [spaceId]);
  return null;
}
