// The whole game screen is this single React island; every other page is
// plain Astro. For now it only proves the island mounts.
export default function Game() {
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
