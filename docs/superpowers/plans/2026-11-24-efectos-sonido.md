# Efectos de sonido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Short sound effects play at the game's key moments, on by default, switchable from a menu under the settings gear.

**Architecture:** A small Web Audio module (`src/audio/sound.ts`) owns the preference, the unlock-on-first-gesture and buffer loading; `play(id, volume?)` is a silent no-op when off, locked or failing. Moments call `play` where they already happen: a pure `turnSounds` for what a committed turn implies (damage, dying, death), and mount effects for banners, loot, level-up and roll cards. The lab gets a "Sonidos" bench to audition every file before wiring (user checkpoint after Task 2).

**Tech Stack:** Astro 7 + React 19, TypeScript, Web Audio API, vitest (+ happy-dom), ffmpeg for converting sources to mp3.

**Spec:** `docs/superpowers/specs/2026-11-24-efectos-sonido-design.md`

## Global Constraints

- UI text in Spanish, identifiers in English.
- No change to the DM prompt or the response schema.
- No new npm dependencies.
- Sound is ON by default; preference in `localStorage` key `dnsolo.sound` (`"on"` / `"off"`), per device; blocked storage means on.
- Nothing plays until the first `pointerdown` or `keydown` in the page; anything before that is silently skipped (not queued).
- Any audio failure (no `AudioContext`, fetch/decode error, blocked resume) is silent: no thrown errors, no UI.
- Files: short mp3s in `public/sounds/<id>.mp3`, licence CC0 or equivalent, no loops. Source + licence of each recorded in `public/sounds/SOURCES.md`; anything requiring attribution is credited in `src/pages/credits.astro`.
- Player dice play the same file as enemy dice at volume `0.5`; everything else at `1`.
- Sounds only for live moments: reloading a game or rendering history plays nothing.

## Review Focus

1. Reload a saved game mid-dying or dead: no heartbeat or bell (Task 4: sounds come from `turnSounds(prev, next)` in `useSendTurn`, never from `DyingNotice`/`GameOver` mount; test that `turnSounds` of equal states is `[]`).
2. Opening an old log: roll cards in history render with `animated` false and must not play dice (Task 4 test on `RollCard` path: play only when `animated`).
3. Switch turned off mid-game: the next moment is silent without reloading (Task 1 test: `play` reads the preference each call).
4. Safari without `AudioContext` / storage blocked: game works, toggles show "on" (Task 1 tests with no `AudioContext` and throwing `localStorage`).
5. Damage that also drops the hero to 0: one sound (heartbeat), not hit + heartbeat (Task 4 test).

---

### Task 1: Sound module

**Files:**
- Create: `src/audio/sound.ts`
- Test: `tests/sound.test.ts`

**Interfaces:**
- Produces:
  - `type SoundId = "dice" | "chapter" | "ambush" | "hit" | "heartbeat" | "loot" | "questDone" | "questFailed" | "levelUp" | "gameOver"`
  - `const SOUND_IDS: readonly SoundId[]` (in the order above)
  - `soundEnabled(): boolean` / `setSoundEnabled(on: boolean): void`
  - `primeSounds(): void` — idempotent; registers one-time `pointerdown`/`keydown` listeners on `document` (capture) that create/resume the `AudioContext` and start fetching+decoding all `SOUND_IDS` from `/sounds/<id>.mp3`
  - `play(id: SoundId, volume?: number): void` — default volume 1; skips when disabled, not yet unlocked, or buffer not ready
  - `resetSoundsForTests(): void`

- [ ] **Step 1: Write failing tests** in `tests/sound.test.ts`:
  - `soundEnabled()` is `true` with empty storage; `setSoundEnabled(false)` → `false` and `localStorage.getItem("dnsolo.sound") === "off"`.
  - `soundEnabled()` is `true` when `localStorage.getItem` throws.
  - With a fake `AudioContext` on `globalThis` (records `createBufferSource` calls; `decodeAudioData` resolves a stub) and `fetch` stubbed: `play("dice")` before any gesture → no source created; after `primeSounds()`, dispatching `pointerdown` on `document` and awaiting loads, `play("dice", 0.5)` → one source started and its gain set to `0.5`.
  - After unlock, `setSoundEnabled(false)` then `play("dice")` → no new source.
  - With `AudioContext` undefined and `fetch` rejecting: `primeSounds()`, a `pointerdown`, then `play("hit")` → does not throw.

- [ ] **Step 2: Run** `pnpm test tests/sound.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/audio/sound.ts`** per the interface. One shared `AudioContext` and gain-per-play (`source → GainNode → destination`); buffers in a `Map<SoundId, AudioBuffer>`; per-file failures are swallowed so one bad file doesn't block the rest.

- [ ] **Step 4: Run** `pnpm test tests/sound.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** `feat: módulo de efectos de sonido`

### Task 2: Sound files and lab bench (user checkpoint)

**Files:**
- Create: `public/sounds/*.mp3` (one per `SoundId`), `public/sounds/SOURCES.md`
- Modify: `src/lab/Lab.tsx` (new `SoundsLab`, rendered first in `Lab`), `src/pages/credits.astro` (only if a chosen file requires attribution)

**Interfaces:**
- Consumes: `SOUND_IDS`, `primeSounds`, `play` from Task 1.

- [ ] **Step 1: Source candidates.** Preferred: Kenney.nl CC0 packs (Casino Audio for dice, RPG Audio for metal/coins, Impact Sounds for hit, Music Jingles for chapter/level-up/quest/game-over). Fall back to Freesound (CC0 filter) or Pixabay for what Kenney lacks (heartbeat, horn, fire, wax seal, bell). Download into the scratchpad, never into the repo.

- [ ] **Step 2: Convert** each pick with `ffmpeg -i <src> -ac 1 -b:a 96k -af "silenceremove=start_periods=1:start_threshold=-50dB" public/sounds/<id>.mp3`; each file ≤ 3 s (except `levelUp`/`gameOver` ≤ 5 s) and ≤ 60 KB.

- [ ] **Step 3: Write `public/sounds/SOURCES.md`**: one row per id — file, origin URL, author, licence.

- [ ] **Step 4: Add `SoundsLab`** to `src/lab/Lab.tsx`: a `lab-stage` section titled "Sonidos", calls `primeSounds()` on mount, one button per id with Spanish labels (Dados, Dados (jugador), Capítulo, Emboscada, Golpe, Latido, Botín, Misión cumplida, Misión fallida, Subida de nivel, Fin de la partida); "Dados (jugador)" plays `dice` at `0.5`.

- [ ] **Step 5: Verify** `pnpm build` passes; open `/lab` in the user's Chrome and click each button — every one sounds.

- [ ] **Step 6: Commit** `feat: sonidos y banco de prueba en el lab`

- [ ] **Step 7: STOP — user checkpoint.** Ask the user to listen in the lab. Swap any file they reject (repeat Steps 1–3 for it) and commit before Task 3.

### Task 3: Settings gear menu with the sound switch

**Files:**
- Modify: `src/layouts/Base.astro` (gear link → button + popover; script wiring), its nav styles (wherever `.icon-button` is styled)

**Interfaces:**
- Consumes: `soundEnabled`, `setSoundEnabled` from Task 1.

- [ ] **Step 1: Replace the gear `<a href="/settings">`** with `<button class="icon-button" popovertarget="settings-menu" aria-label="Configuración" title="Configuración">` (same SVG) and a `<div id="settings-menu" popover>` holding a labelled checkbox switch `<input type="checkbox" role="switch" id="sound-switch">` with text "Sonido", and a link `<a href="/settings">Configuración</a>`. Native popover: light-dismiss and Esc come free.

- [ ] **Step 2: Wire the switch** in the existing `<script>`: initial `checked = soundEnabled()`; on `change` → `setSoundEnabled(checked)`.

- [ ] **Step 3: Style** the popover anchored under the gear, right-aligned, using existing theme tokens so it works in light and dark.

- [ ] **Step 4: Verify** `pnpm build` and `pnpm check` pass; in the user's Chrome: gear opens the menu on `/`, `/play` and `/settings`; switch survives reload; the link goes to `/settings`; Esc and clicking outside close it; mobile width doesn't overflow.

- [ ] **Step 5: Commit** `feat: el engranaje abre un menú con el switch de sonido`

### Task 4: Play sounds at the game's moments

**Files:**
- Create: `src/game/turnSounds.ts`
- Modify: `src/game/useSendTurn.ts` (after commit, next to `shakeScreen`), `src/game/Game.tsx` (`primeSounds()` on mount), `src/game/TopBanner.tsx` (optional `sound` prop played on mount), callers of `TopBanner` that render queued banners (`Game.tsx`, `LabBanner` in `src/lab/Lab.tsx`), `src/game/EventToasts.tsx` (loot toast mount), `src/game/LevelUpScreen.tsx` (mount effect), `src/game/TurnLog.tsx` (`RollCard`)
- Test: `tests/turnSounds.test.ts`, `tests/bannerQueue.test.ts`

**Interfaces:**
- Consumes: `play`, `primeSounds`, `SoundId` from Task 1; `Banner` from `src/game/bannerQueue.ts`.
- Produces:
  - `turnSounds(prev: GameState, next: GameState, events: readonly string[]): SoundId[]`
  - `bannerSound(banner: Banner): SoundId` (in `bannerQueue.ts`)

- [ ] **Step 1: Write failing tests.**
  - `turnSounds`: hero `players[0]` condition `ok` → `dead` gives `["gameOver"]`; `ok` → `dying` with HP drop gives `["heartbeat"]` (not `hit`); `dying` → `dying` (a death save turn) gives `["heartbeat"]`; HP drop staying `ok` gives `["hit"]` (reuse `tookDamage`); identical states and no events gives `[]`; `dead` → `dead` gives `[]`.
  - `bannerSound`: chapter → `"chapter"`, ambush → `"ambush"`, quest completed → `"questDone"`, quest failed → `"questFailed"`.

- [ ] **Step 2: Run** `pnpm test tests/turnSounds.test.ts tests/bannerQueue.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `turnSounds` and `bannerSound`. In `useSendTurn`, after commit, `turnSounds(state, outcome.state, outcome.response.events).forEach((id) => play(id))`.

- [ ] **Step 4: Hook the mount-time moments.**
  - `TopBanner`: new prop `sound?: SoundId`, played once in the mount effect; Game and LabBanner pass `bannerSound(head)`.
  - `EventToasts`: in the toast's mount effect, `if (toast.kind === "loot") play("loot")`.
  - `LevelUpScreen`: `play("levelUp")` where the dialog opens (only when it wasn't already open).
  - `RollCard`: when `animated`, play `"dice"` once on mount at volume `1` for `variant === "enemy"`, `0.5` for `"player"`.
  - `Game.tsx`: `useEffect(() => primeSounds(), [])`.

- [ ] **Step 5: Run** `pnpm test` (whole suite) and `pnpm check` — Expected: PASS.

- [ ] **Step 6: Verify in the user's Chrome** with a real campaign: send a turn with a roll (dice), trigger damage if possible; toggle the switch off from the gear and confirm the next roll is silent; reload and confirm nothing plays on load.

- [ ] **Step 7: Commit** `feat: los momentos clave suenan`, then mark Ambiente/efectos as done in `docs/roadmap.md` (`docs: efectos de sonido hechos en el roadmap`).
