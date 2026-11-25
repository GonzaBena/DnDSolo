import { useEffect, useState } from "react";
import type { GameState } from "../domain/types";
import DiceLoader from "../game/DiceLoader";
import { createGameRepo } from "../sync/runtime";
import { CampaignMissing, CampaignView } from "./CampaignView";
import "../game/styles/avatar.css";
import "./campaign.css";

type View = { status: "loading" } | { status: "missing" } | { status: "ready"; state: GameState };

/** /campaign?id=…: reads the save from this browser and shows it. Read
    only, so it doesn't sync with Drive first. */
export default function CampaignPage() {
  const [view, setView] = useState<View>({ status: "loading" });
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setView({ status: "missing" });
      return;
    }
    createGameRepo()
      .load(id)
      .then(
        (state) => setView(state ? { status: "ready", state } : { status: "missing" }),
        () => setView({ status: "missing" }),
      );
  }, []);
  if (view.status === "loading") return <DiceLoader label="Cargando campaña…" />;
  if (view.status === "missing") return <CampaignMissing />;
  return <CampaignView state={view.state} />;
}
