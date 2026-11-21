import { useState } from "react";
import { portraitUrl } from "../domain/portraits";
import type { Attitude, Npc } from "../domain/types";

/** "Mateo Valen" -> "MV". A single-word name uses its first two letters
    ("Lira" -> "LI") so the label is always the same width. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length >= 2
      ? words[0]![0]! + words[1]![0]!
      : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}

/** Someone's face: their portrait when the NPC has one and it loads, their
    initials otherwise. The ring takes the colour of what they are (an NPC's
    attitude, or the DM or a player). Decorative: the name is always next
    to it. */
export function NpcAvatar({
  name,
  npc,
  size,
  kind,
  speaking = false,
}: {
  name: string;
  npc: Npc | undefined;
  size: "sm" | "lg";
  /** Who they are when it isn't an NPC; an NPC's attitude otherwise. */
  kind?: "dm" | "player" | Attitude;
  speaking?: boolean;
}) {
  const url = npc?.portrait ? portraitUrl(npc.portrait, npc.name) : null;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = url !== null && url !== failedUrl;
  return (
    <span
      className={`avatar avatar--${size}${speaking ? " avatar--speaking" : ""}`}
      data-kind={kind ?? npc?.attitude ?? "neutral"}
      title={name}
      aria-hidden="true"
    >
      <span className="avatar__face">
        {showImage ? (
          <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(url)} />
        ) : (
          initials(kind === "dm" ? "DM" : name)
        )}
      </span>
    </span>
  );
}
