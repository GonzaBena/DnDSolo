import { useEffect, useState } from "react";
import { isConfigured, loadSettings } from "../persistence/settings";

// The whole game screen is this single React island; every other page is
// plain Astro.
export default function Game() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Without a key there is nothing to play: send the player to settings,
    // which explains why they landed there (Spec, MVP scope 2).
    if (!isConfigured(loadSettings())) {
      location.replace("/settings?missing=1");
      return;
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <section>
      <h1>Partida</h1>
      <p className="placeholder">Acá va la narración del DM, tu respuesta y las tiradas.</p>
      <div className="actions">
        <a className="button" href="/">
          Salir al inicio
        </a>
      </div>
    </section>
  );
}
