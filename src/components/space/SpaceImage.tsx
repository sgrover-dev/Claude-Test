"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

const GRADIENTS: Record<string, string> = {
  patio: "from-sage-500/70 to-gold-300/80",
  rooftop: "from-ink-700 to-gold-500/70",
  wine_room: "from-rope-800 to-rope-500",
  chefs_table: "from-ink-800 to-rope-700",
  bar_lounge: "from-ink-900 to-ink-600",
  full_buyout: "from-rope-700 to-ink-800",
  default: "from-rope-600 to-ink-700",
};

export function SpaceImage({ src, alt, spaceType, className = "", sizesHint = "" }: { src: string | null | undefined; alt: string; spaceType?: string; className?: string; sizesHint?: string }) {
  const [failed, setFailed] = useState(false);
  const gradient = GRADIENTS[spaceType ?? ""] ?? GRADIENTS.default;
  if (!src || failed) {
    return (
      <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} ${className}`} role="img" aria-label={alt}>
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_45%),radial-gradient(circle_at_80%_70%,white,transparent_40%)]" />
        <span className="absolute bottom-3 left-3 rounded-md bg-black/25 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-white/90">
          {src ? "Photo unavailable" : "No photo yet"}
        </span>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} data-sizes={sizesHint} />;
}
