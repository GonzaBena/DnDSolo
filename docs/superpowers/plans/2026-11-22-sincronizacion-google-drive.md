# Sincronización con Google Drive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optional sync of campaigns across devices through the player's own Google Drive (`appDataFolder`), with browser-only token renewal by default and an opt-in server renewal.

**Architecture:** A `SyncedGameRepo` wraps `IndexedDBGameRepo`: local is always the source of truth for reads and writes, and a `SyncEngine` reconciles with a `RemoteGameStore` (Drive) in the background using a pure `reconcile()` function and per-account "bases". Auth sits behind `DriveAuth` with two implementations (Google Identity Services token client; code client + Astro server routes that keep a sealed refresh token in an HttpOnly cookie).

**Tech Stack:** Astro 7 + `@astrojs/node` (standalone), React 19, TypeScript strict, Vitest + `fake-indexeddb`, Google Identity Services, Drive REST v3 via `fetch`, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-11-22-sincronizacion-google-drive-design.md`

## Global Constraints

- Identifiers and comments in English; every UI string in Spanish (rioplatense, "vos").
- Sync is opt-in: with it off, no page loads GIS, calls Drive, or shows new UI. `createGameRepo()` returns a plain `IndexedDBGameRepo`.
- Drive errors never reject a `GameRepo` promise and never surface as a turn error.
- OAuth scope: exactly `https://www.googleapis.com/auth/drive.appdata`. No `email`/`openid`.
- API key and settings are never synced.
- Pages stay prerendered; only `src/pages/api/drive/*.ts` set `export const prerender = false`.
- Env: `PUBLIC_GOOGLE_CLIENT_ID` (build-time, public), `GOOGLE_CLIENT_SECRET` and `SESSION_SECRET` (server only). `.env` stays gitignored.
- Hostinger: output dir `dist`, entry file `server/entry.mjs` (relative to `dist`).
- localStorage keys: `dnsolo.sync` (config), `dnsolo.sync.bases` (bases). Every read/write in try/catch.
- Tests live in `tests/*.test.ts`, run with `pnpm test`; typecheck with `pnpm check`.

## Review Focus

1. Drive answers 401 mid-sync (token revoked or expired) → status becomes `reconnect`, the local save already succeeded, and the pending push runs after reconnecting. Test in Task 4.
2. Network down (`fetch` throws `TypeError`) while playing → status `offline`, nothing lost, `flush()` on `online` uploads the latest state. Test in Task 4.
3. Several saves in a row (turn + HP fix) → only the newest state is uploaded, never an older one after a newer one. Test in Task 4.
4. A Drive file that `migrateSave` can't read (corrupt, or from a newer app version) → that game is skipped: no download, no overwrite of either side, no crash. Test in Task 4.
5. The player closes the Google popup or denies consent → sync stays off (connect) or the turn proceeds with the push still pending (renew); no unhandled rejection. Test in Task 5.

---

### Task 1: Pure reconciliation

**Files:**
- Create: `src/sync/types.ts`, `src/sync/reconcile.ts`
- Test: `tests/reconcile.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/sync/types.ts
  export interface LocalEntry { id: string; updatedAt: string; turnCount: number }
  export interface RemoteEntry { id: string; updatedAt: string; turnCount: number; deleted: boolean }
  export type Bases = Record<string, string>; // gameId -> updatedAt both sides agreed on
  export type SyncAction =
    | { type: "upload"; id: string }
    | { type: "download"; id: string }
    | { type: "delete_local"; id: string }
    | { type: "tombstone"; id: string }
    | { type: "forget_base"; id: string }
    | { type: "mark_synced"; id: string; updatedAt: string }
    | { type: "conflict"; id: string; kind: "both_changed" | "deleted_remotely" };
  // src/sync/reconcile.ts
  export function reconcile(local: LocalEntry[], remote: RemoteEntry[], bases: Bases): SyncAction[];
  ```

- [ ] **Step 1: Write the failing tests** — one `it` per row, named after it. With `B = "t1"`, `newer = "t2"`, `newest = "t3"`:
  - only local → `[{type:"upload"}]`; only remote (not deleted) → `download`
  - L changed, R = B → `upload`; R changed, L = B → `download`; both changed → `conflict both_changed`
  - R tombstone, L = B → `delete_local` + `forget_base`; R tombstone, L changed → `conflict deleted_remotely`
  - L missing, base exists, R = B → `tombstone`; L missing, base, R changed → `download`; L missing, base, R tombstone → `forget_base`
  - L = B, R missing entirely → `upload`
  - L.updatedAt === R.updatedAt → `mark_synced` with that updatedAt
  - no base, both exist, L newer → `upload`; R newer → `download` (first connection, newest wins)
  - no base, R tombstone, L exists → `conflict deleted_remotely`
  - only R tombstone, no L, no base → `[]`
- [ ] **Step 2:** `pnpm test tests/reconcile.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement `reconcile` over the union of ids; ISO strings compare with `<`/`===`. Order of output follows id order of `local` then remaining `remote`.
- [ ] **Step 4:** `pnpm test tests/reconcile.test.ts` → PASS.
- [ ] **Step 5:** Commit `feat(sync): reconciliación pura entre local, Drive y bases`.

---

### Task 2: Sync config, bases and status

**Files:**
- Create: `src/sync/config.ts`, `src/sync/bases.ts`, `src/sync/status.ts`
- Test: `tests/syncConfig.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // config.ts
  export interface SyncConfig { enabled: boolean; autoRenew: boolean }
  export function loadSyncConfig(): SyncConfig;          // {false,false} on missing/corrupt/blocked
  export function saveSyncConfig(config: SyncConfig): void;
  // bases.ts — stored as { [accountId]: Bases } under "dnsolo.sync.bases"
  export class SyncBases {
    constructor(accountId: string);
    all(): Bases; set(id: string, updatedAt: string): void; forget(id: string): void;
    clearAccount(): void;
  }
  // status.ts
  export type SyncState = "off" | "idle" | "syncing" | "offline" | "reconnect" | "error";
  export interface SyncStatus { state: SyncState; lastSyncedAt: string | null }
  export const syncStatus: {
    get(): SyncStatus; set(patch: Partial<SyncStatus>): void;
    subscribe(listener: (s: SyncStatus) => void): () => void;
  };
  ```

- [ ] **Step 1: Failing tests** (stub `localStorage` with an in-memory Map like `tests/settings.test.ts`): config defaults to `{enabled:false, autoRenew:false}` for missing and for `"{bad"`; round-trips; bases of account `a` are invisible from account `b`; `clearAccount()` on `a` leaves `b` intact; `syncStatus.subscribe` receives the merged status on `set` and stops after unsubscribe.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `feat(sync): configuración, bases por cuenta y estado`.

---

### Task 3: Remote store (Drive REST + in-memory)

**Files:**
- Create: `src/sync/RemoteGameStore.ts`, `src/sync/InMemoryRemoteGameStore.ts`, `src/sync/DriveGameStore.ts`
- Test: `tests/DriveGameStore.test.ts`

**Interfaces:**
- Consumes: `RemoteEntry` (Task 1).
- Produces:
  ```ts
  export class AuthExpiredError extends Error {}   // Drive answered 401
  export class OfflineError extends Error {}       // fetch threw (network)
  export interface RemoteGameStore {
    accountId(): Promise<string>;
    list(): Promise<RemoteEntry[]>;
    get(id: string): Promise<unknown | null>;  // raw JSON; null if missing or tombstone
    put(state: GameState): Promise<void>;
    tombstone(id: string): Promise<void>;
  }
  export class DriveGameStore implements RemoteGameStore {
    constructor(getToken: () => Promise<string>, fetchFn?: typeof fetch);
  }
  export class InMemoryRemoteGameStore implements RemoteGameStore { /* + failNext(error: Error): void for tests */ }
  ```
- Drive details (pinned):
  - File name `game-<id>.json`, parent `appDataFolder`, `appProperties`: `gameId`, `updatedAt`, `turnCount` (string), `deleted` (`"true"` or absent).
  - List: `GET https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=nextPageToken,files(id,name,appProperties)&pageSize=1000`, following `nextPageToken`.
  - Create: `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`; update: `PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=multipart` (no `parents` on update). Body `multipart/related` with JSON metadata part + JSON content part.
  - Content: `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`.
  - Tombstone: update content to `{"deleted":true,"deletedAt":<ISO>}`, `appProperties.deleted="true"`.
  - `accountId()`: the Drive file id of `account.json` in `appDataFolder`, created empty on first call and cached. (Deviation from the spec's `about.permissionId`: `about.get` is not guaranteed under `drive.appdata` alone; appDataFolder is per-account, so the marker file id identifies the account equally well.)
  - `Authorization: Bearer <token>`; 401 → `AuthExpiredError`; `fetch` rejection → `OfflineError`; other non-2xx → `Error` with status.

- [ ] **Step 1: Failing tests** with a fake `fetchFn` that records requests and serves a tiny in-memory Drive: `put` then `list` returns the entry with `turnCount` as number; second `put` of the same id issues a `PATCH` to the same file id (no duplicate file); `tombstone` → `list` shows `deleted: true` and `get` returns `null`; 401 → rejects `AuthExpiredError`; `fetchFn` throwing `TypeError` → `OfflineError`; `list` follows `nextPageToken`; `accountId()` creates `account.json` once across two calls.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement both stores (file-id lookup cached from the last `list`, re-listed on miss).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `feat(sync): almacenamiento de partidas en la carpeta oculta de Drive`.

---

### Task 4: SyncEngine and SyncedGameRepo

**Files:**
- Create: `src/sync/SyncEngine.ts`, `src/sync/SyncedGameRepo.ts`
- Test: `tests/SyncEngine.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `migrateSave` from `src/persistence/migrations.ts`; `GameRepo`.
- Produces:
  ```ts
  export interface SyncConflict {
    id: string; kind: "both_changed" | "deleted_remotely";
    local: GameState | null; remote: GameState | null;
  }
  export type ConflictChoice = "local" | "remote";
  export class SyncEngine {
    constructor(deps: {
      local: GameRepo; remote: RemoteGameStore;
      bases: (accountId: string) => SyncBases;
      resolveConflict: (c: SyncConflict) => Promise<ConflictChoice>;
    });
    syncAll(): Promise<void>;
    /** Reconciles one game; tells the caller whether local changed. */
    syncGame(id: string): Promise<"downloaded" | "unchanged">;
    schedulePush(id: string): void;     // collapses: one in flight + at most one queued per id
    deleteEverywhere(id: string): void; // background tombstone; base kept until it lands
    flush(): Promise<void>;             // runs everything pending
  }
  export class SyncedGameRepo implements GameRepo {
    constructor(local: GameRepo, engine: SyncEngine);
  }
  ```
- Behavior: `syncStatus` goes `syncing` → `idle` (+`lastSyncedAt`), `offline` on `OfflineError`, `reconnect` on `AuthExpiredError`, `error` otherwise; failed pushes stay pending for `flush()`. Before each upload, re-read remote `updatedAt` via `list()`; if it differs from the base, run `reconcile` for that id instead of uploading. Conflict choice `local` → upload; `remote` → download; for `deleted_remotely`, `local` = restore (upload), `remote` = `delete_local`. Downloads go through `migrateSave`; `null` → skip that id. `SyncedGameRepo.save/delete` await local, then `schedulePush`/`deleteEverywhere`; reads are local only.

- [ ] **Step 1: Failing tests** (`fake-indexeddb/auto`, `InMemoryRemoteGameStore`, `newGame()` from `tests/helpers.ts`):
  - two devices (two `InMemoryGameRepo` from `src/persistence/InMemoryGameRepo.ts`, each with its own `SyncBases`) sharing one remote: save on A, `flush`, `syncAll` on B → B loads A's state.
  - delete on A while `remote.failNext(new OfflineError())`, then `flush` → remote tombstoned; `syncAll` on B removes B's copy.
  - both changed → `resolveConflict` called once with both states; choosing `remote` leaves local equal to remote.
  - `schedulePush` three times quickly with turns 1,2,3 → remote ends with turn count 3 and never receives 2 after 3.
  - Review Focus 1: `failNext(new AuthExpiredError())` → `syncStatus.get().state === "reconnect"`, `SyncedGameRepo.save` resolved, later `flush()` uploads.
  - Review Focus 2: `failNext(new OfflineError())` → state `offline`; `flush()` uploads.
  - Review Focus 4: remote content `{version: 999}` → `syncAll` leaves local untouched, no throw.
  - `syncGame` returns `"downloaded"` only when local was replaced.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** run → PASS; `pnpm test` all green.
- [ ] **Step 5:** Commit `feat(sync): motor de sincronización y repo sincronizado`.

---

### Task 5: Browser auth (GIS token client) and runtime

**Files:**
- Create: `src/sync/DriveAuth.ts`, `src/sync/BrowserDriveAuth.ts`, `src/sync/gis.ts`, `src/sync/runtime.ts`
- Modify: `src/env.d.ts` (or create) to type `PUBLIC_GOOGLE_CLIENT_ID`
- Test: `tests/BrowserDriveAuth.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  export interface DriveAuth {
    /** Valid token or rejects AuthExpiredError; never opens UI. */
    getAccessToken(): Promise<string>;
    /** True when the next action should renew via a user gesture (browser: no token or < 10 min left). */
    needsGesture(): boolean;
    /** MUST be called synchronously inside a click/submit handler. Resolves false on close/deny/20 s timeout. */
    renewWithGesture(): Promise<boolean>;
    connect(): Promise<boolean>;     // first consent; false if closed/denied
    disconnect(): Promise<void>;
  }
  export class BrowserDriveAuth implements DriveAuth {
    constructor(deps: { clientId: string; gis: () => GisTokenApi; now?: () => number });
  }
  // gis.ts
  export function loadGis(): Promise<void>; // injects https://accounts.google.com/gsi/client once
  // runtime.ts — one per page
  export interface SyncRuntime { auth: DriveAuth; engine: SyncEngine; repo: GameRepo }
  export function getSyncRuntime(): SyncRuntime | null; // null when config.enabled is false
  export function createGameRepo(): GameRepo;          // SyncedGameRepo or IndexedDBGameRepo
  export function withRenewal<T>(sync: SyncRuntime | null, run: () => Promise<T>): Promise<T>;
  ```
- `withRenewal` starts `renewWithGesture()` synchronously when `needsGesture()`, awaits it (max 20 s, outcome ignored), then calls `run`. This is the one helper every gesture site uses.
- `getSyncRuntime` registers `online` and `visibilitychange`(hidden) listeners calling `engine.flush()`; token kept in memory with its expiry (`expires_in`); `renewWithGesture` calls `requestAccessToken({ prompt: "" })`; `disconnect` calls `google.accounts.oauth2.revoke`.

- [ ] **Step 1: Failing tests** with a fake GIS (`initTokenClient` returning a client whose `requestAccessToken` the test resolves/rejects): `needsGesture()` true with no token, false right after a token of `expires_in: 3600`, true again at `now + 51 min`; `getAccessToken()` rejects `AuthExpiredError` when expired; Review Focus 5: popup closed (`error_callback` with `popup_closed`) → `renewWithGesture()` resolves `false` and `connect()` resolves `false`; no callback in 20 s → `false`; `withRenewal` calls `requestAccessToken` before its first await (assert the call happened synchronously after `withRenewal(...)` returns the promise).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `feat(sync): autenticación con Google desde el navegador`.

---

### Task 6: Server renewal (adapter, routes, sealed cookie)

**Files:**
- Modify: `astro.config.mjs` (add `adapter: node({ mode: 'standalone' })`), `package.json` (`@astrojs/node`)
- Create: `src/server/seal.ts`, `src/server/googleTokens.ts`, `src/pages/api/drive/connect.ts`, `src/pages/api/drive/token.ts`, `src/pages/api/drive/disconnect.ts`, `src/sync/ServerDriveAuth.ts`, `.env.example`
- Test: `tests/seal.test.ts`, `tests/googleTokens.test.ts`, `tests/ServerDriveAuth.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // seal.ts — AES-256-GCM, key = sha256(secret), output base64url(iv|tag|ciphertext)
  export function seal(plain: string, secret: string): string;
  export function unseal(sealed: string, secret: string): string | null;
  // googleTokens.ts
  export interface AccessGrant { accessToken: string; expiresAt: number }
  export function exchangeCode(code: string, env: GoogleEnv, fetchFn?: typeof fetch): Promise<AccessGrant & { refreshToken: string }>;
  export function refreshAccess(refreshToken: string, env: GoogleEnv, fetchFn?: typeof fetch): Promise<AccessGrant>;
  export function revoke(token: string, fetchFn?: typeof fetch): Promise<void>;
  // ServerDriveAuth: needsGesture() always false; getAccessToken() POSTs /api/drive/token when < 10 min left
  export class ServerDriveAuth implements DriveAuth { constructor(deps: { clientId: string; gis: () => GisCodeApi; fetchFn?: typeof fetch }) }
  ```
- Pinned: token endpoint `https://oauth2.googleapis.com/token` (`redirect_uri: "postmessage"`), revoke `https://oauth2.googleapis.com/revoke`. Cookie `dnsolo_drive`, `HttpOnly; Secure; SameSite=Strict; Path=/api/drive; Max-Age=15552000`. Routes accept only `POST` with `Content-Type: application/json`, else 415. `/token` → 401 when cookie missing/unsealable or Google says `invalid_grant` (and clears the cookie). Code client: `initCodeClient({ scope: DRIVE_SCOPE, ux_mode: "popup", access_type: "offline", prompt: "consent" })`. `getSyncRuntime` picks `ServerDriveAuth` when `config.autoRenew`.

- [ ] **Step 1: Failing tests:** `unseal(seal(x, s), s) === x`; wrong secret or tampered byte → `null`; `exchangeCode` posts `grant_type=authorization_code` + `redirect_uri=postmessage` and maps `expires_in` to `expiresAt`; `refreshAccess` with `invalid_grant` rejects; `ServerDriveAuth.getAccessToken` makes no request while the token has > 10 min, one request after, and maps 401 to `AuthExpiredError`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement helpers, routes (`export const prerender = false`; read env via `import.meta.env`), and `ServerDriveAuth`. `.env.example` lists the three variables with empty values.
- [ ] **Step 4:** `pnpm test` → PASS; `pnpm build` succeeds and `dist/server/entry.mjs` exists; run it with `PORT=4399` and `curl -X POST localhost:4399/api/drive/token -H 'Content-Type: application/json'` → `401`.
- [ ] **Step 5:** Commit `feat(sync): renovación automática desde el servidor`.

---

### Task 7: Conflict dialog and status indicator (shared vanilla UI)

**Files:**
- Create: `src/sync/conflictDialog.ts`, `src/sync/indicator.ts`, `src/sync/sync.css`
- Test: `tests/syncUi.test.ts` (pure copy helpers only)

**Interfaces:**
- Produces:
  ```ts
  export function describeVersion(state: GameState, now: number): string; // "turno 42 · hace 2 h"
  export function showConflictDialog(conflict: SyncConflict): Promise<ConflictChoice>; // <dialog>
  export function mountSyncIndicator(host: HTMLElement): () => void; // subscribes to syncStatus
  export const STATUS_LABEL: Record<SyncState, string>;
  ```
- Copy (exact): title "Esta campaña cambió en dos lugares"; rows "Este dispositivo · …" [Quedarme con esta], "Google Drive · …" [Usar la de Drive]; footer "La otra versión se descarta." plus link "Exportar la otra versión" (calls `downloadGame` on the losing side). `deleted_remotely`: title "Esta campaña se borró en otro dispositivo", buttons [Restaurarla] (`local`) / [Borrarla acá también] (`remote`). Labels: `idle` "Sincronizado", `syncing` "Sincronizando…", `offline` "Sin conexión, se sube después", `reconnect` "Reconectar" (button that calls `withRenewal(sync, () => sync.engine.flush())`), `error` "No se pudo sincronizar", `off` hidden.
- `getSyncRuntime` passes `showConflictDialog` as `resolveConflict`.

- [ ] **Step 1: Failing tests:** `describeVersion` for 10 min / 2 h / 3 días ago and turn count; `STATUS_LABEL` values exactly as above.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement; style with existing tokens from `src/styles/tokens.css`, reuse `.button`.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `feat(sync): diálogo de choque e indicador de estado`.

---

### Task 8: Wire repos and the game screen

**Files:**
- Modify: `src/game/Game.tsx` (lines ~99–118 load; `submitAction` ~343, `submitRoll` ~388, `submitDeathSave` ~401; mount indicator in the header area), `src/character/CharacterForm.tsx:63`
- Test: `tests/openGame.test.ts`

**Interfaces:**
- Consumes: `getSyncRuntime`, `createGameRepo`, `withRenewal`, `mountSyncIndicator`.
- Produces:
  ```ts
  // src/sync/openGame.ts
  /** Reconciles `id` for up to `timeoutMs`; returns whether it finished in time and a promise of the late result. */
  export function syncBeforeOpen(sync: SyncRuntime | null, id: string | null, timeoutMs?: number /* 3000 */):
    Promise<{ late: Promise<"downloaded" | "unchanged"> | null }>;
  ```
- Game load: `repo = createGameRepo()`; for `/play` without id, call `sync.engine.syncAll()` within the same 3 s budget before `loadLatest()`. If `late` resolves `"downloaded"` and no turn was sent this session (track with a ref set in `send`), reload from repo, build a fresh `TurnEngine`, and show the existing warning banner with "Se cargó la versión más reciente de Drive". If a turn was already sent, call `sync.engine.syncGame(id)` again so the conflict dialog decides.
- Each submit handler wraps its `send(...)` in `withRenewal(sync, () => send(...))`, keeping the call synchronous in the handler.
- `CharacterForm` saves through `createGameRepo()`.

- [ ] **Step 1: Failing tests** for `syncBeforeOpen` with fake timers: resolves immediately with `late: null` when `sync` is null; resolves after reconcile when it takes 1 s (`late` null); resolves at 3 s with a non-null `late` when it takes 5 s; an `OfflineError` resolves without throwing.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement `syncBeforeOpen`, then the `Game.tsx` and `CharacterForm.tsx` changes.
- [ ] **Step 4:** `pnpm test` and `pnpm check` → PASS. Manual: with sync off, `/play` behaves exactly as before (no network requests to Google in devtools).
- [ ] **Step 5:** Commit `feat(sync): la pantalla de juego sincroniza al abrir y renueva al enviar`.

---

### Task 9: Home and settings pages

**Files:**
- Modify: `src/pages/index.astro`, `src/pages/settings.astro`

**Interfaces:**
- Consumes: everything above; `loadSyncConfig`/`saveSyncConfig`.

- [ ] **Step 1: Home (`index.astro`):** `repo = createGameRepo()`. With sync on: mount indicator; `refresh()` local first, then `engine.syncAll()` and `refresh()` again. When `auth.needsGesture()`, show notice with button "Tocá para traer tus partidas de Drive" → `withRenewal(sync, () => sync.engine.syncAll())` then `refresh()`. Clicks on "Continuar" and each "Jugar": if `needsGesture()`, `preventDefault()`, then `withRenewal(sync, () => syncBeforeOpen(sync, id))` and `location.href = href`. Armed delete label becomes "¿Seguro? Se borra en todos tus dispositivos" when sync is on.
- [ ] **Step 2: Settings (`settings.astro`):** new `<section>` "Sincronización entre dispositivos" with the exact copy from the spec's mockup. Off: [Conectar Google Drive] → `connect()`; on success `saveSyncConfig({enabled:true, autoRenew:false})`, `syncAll()`, show connected state; on `false` stay off with status "No se conectó con Google." On: status line from indicator + "última sincronización hace …"; checkbox "Renovar la conexión automáticamente" with the spec's helper text — toggling disconnects the current auth, then `connect()` with the other implementation, saving `autoRenew` only on success; [Sincronizar ahora] → `withRenewal(sync, () => engine.syncAll())`; [Desconectar] → `auth.disconnect()`, `SyncBases.clearAccount()`, `saveSyncConfig({enabled:false, autoRenew:false})`. Hide the whole section when `PUBLIC_GOOGLE_CLIENT_ID` is empty.
- [ ] **Step 3:** `pnpm check` and `pnpm test` → PASS.
- [ ] **Step 4: Manual on `http://localhost:4321`** with a real client id in `.env`: connect, create a campaign, see it in Drive via a second browser profile (connect same account → it appears), delete in one → gone in the other after reload, force a conflict (play offline in both via devtools) → dialog. Repeat with auto-renew on (`pnpm build && node dist/server/entry.mjs`).
- [ ] **Step 5:** Commit `feat(sync): conectar Drive desde Configuración y sincronizar la lista`.

---

### Task 10: Docs and deploy notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** Add "Sincronización (opcional)" under Características; change "Sin servidor" to say the site is static except three optional routes for automatic renewal; add a "Puesta en marcha de Google Drive" section with the spec's three setup steps and the Hostinger fields (output `dist`, entry `server/entry.mjs`, the two secret env vars plus `PUBLIC_GOOGLE_CLIENT_ID`); add `src/sync/` and `src/server/` to the architecture tree.
- [ ] **Step 2:** `pnpm build` → succeeds.
- [ ] **Step 3:** Commit `docs: sincronización con Google Drive y despliegue en Hostinger`.
