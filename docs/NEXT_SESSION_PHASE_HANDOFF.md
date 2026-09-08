# EchoVerse Phase — Full Continuation Handoff

**Prepared:** 2026-09-07 / 2026-09-08 UTC boundary  
**Repository:** `aerovista-us/phase`  
**Live alpha:** `https://phase.aerovista.us/`  
**Current visible version:** **Phase 0.12.8**  
**Current `main` head:** `4fbfb7da0b92bcf0c56e1a9c60471071299290cc`  
**Project schema:** `v12`  
**Service-worker shell:** `echoverse-phase-shell-v41`  
**Session storage key:** `echoverse.phase.session.v5`

---

## 1. Purpose of this handoff

This is the first reference point for the next Phase session. It records the product intent, settled architecture, current implementation, release gates, exact repository state, QA status, known risks, and the recommended order of work.

The next session should **not** spend time rediscovering the architecture or re-litigating decisions that are already settled. Read this file first, then inspect the current repository before making edits because repository contents remain authoritative.

### Read in this order when resuming

1. `docs/NEXT_SESSION_PHASE_HANDOFF.md`
2. `README.md`
3. `index.html`
4. `js/state.js`
5. `js/project-model.js`
6. `js/mix-ui.js`
7. `js/render.js`
8. `js/render-core.js`
9. `js/stem-render.js`
10. `js/stem-provider.js`
11. `js/project-ui.js`
12. `js/diagnostics.js`
13. `js/session-safety.js`
14. `sw.js`
15. `.github/workflows/test.yml`
16. `.github/workflows/pages.yml`
17. `.github/workflows/browser-smoke.yml`
18. `tests/e2e/phase.smoke.spec.mjs`

If continuing deployment or QA work, inspect current GitHub Actions before assuming any previous run is still the latest.

---

# 2. Executive status

Phase has moved well beyond the original static `cuts.html` prototype. It is now a working local-first browser audio workstation/PWA with a real project/edit model, analysis, alignment, nondestructive arrangement tools, pitch and timing render, stem-aware playback/export, project persistence, diagnostics/recovery, staged startup, and automated browser QA.

The current foundation is strong enough to treat the product as **pre-release-candidate alpha**, rather than an early prototype.

The key architectural loop is now real:

```text
LOAD AUDIO
    ↓
ANALYZE
    ↓
CORRECT / CHOOSE MUSICAL GRID
    ↓
ALIGN / ARRANGE / WARP / TRIM / FADE
    ↓
VISUAL CHANGES PENDING
    ↓
⚡ RENDER CHANGES
    ↓
AUDIO CURRENT
    ↓
PLAYBACK / LOOP / EXPORT
```

The most important validation completed in this session is that this flow now runs successfully in **real Chromium automation**, not only unit tests.

---

# 3. Current authoritative repository / deployment state

## Repository

`aerovista-us/phase`

Default branch:

`main`

Current head:

`4fbfb7da0b92bcf0c56e1a9c60471071299290cc`

Commit message:

`Prove Phase lifecycle persistence and offline relaunch in Chromium`

### Important repository governance note

At the time of this handoff, GitHub reports `main` as **not branch-protected**, with required status checks enforcement off.

The deployment itself is nevertheless test-gated by the Pages workflow, but branch protection is still worth considering before calling 1.0 stable.

Do not accidentally equate "deployment gate" with "protected branch." They are different controls.

---

# 4. Hosting and deployment

## Primary production path

**GitHub Pages** is the settled deployment mechanism.

Custom domain:

`phase.aerovista.us`

Repository contains `CNAME` and the Pages workflow preserves it in the artifact.

### Do not return to Vercel as the critical deployment path

Vercel was tested early and abandoned because the connected deployment path repeatedly hung. GitHub Pages has been reliable and is now deeply integrated into the test/release process.

Vercel should only be revisited if there is a new product reason, not as a routine deployment fallback.

## Pages build artifact

`.github/workflows/pages.yml` copies:

- `index.html`
- `recovery.html`
- `styles.css`
- `ui-polish.css`
- `manifest.webmanifest`
- `sw.js`
- `icons/`
- `js/`
- `CNAME` when present

The workflow also generates `_site/build.json` after syntax/tests pass.

Current build metadata contract:

```json
{
  "version": "0.12.8",
  "commit": "<GITHUB_SHA>",
  "builtAt": "<UTC ISO timestamp>",
  "validated": true,
  "channel": "alpha",
  "workflowRun": "<GITHUB_RUN_ID>"
}
```

This is intentionally fetched network-first so DIAG/recovery can detect stale application state.

---

# 5. Latest verified CI / release gates

The exact `main` handoff commit is green across the major gates.

## Standard Phase checks

Run ID:

`34171820887`

Result:

**SUCCESS**

The job ran:

- Node 22 setup
- `npm run check`
- `npm test`

Latest unit/model/static-shell suite:

**134 tests passed / 0 failed**

These tests cover analysis, meter, phrase snapping, explicit marker alignment, playback windows, key/mashup compatibility, demo generation, diagnostics, persistence, project/package schemas, rendering, resource preflight, stems/provider behavior, static shell integrity, PWA cache behavior, and transport.

## GitHub Pages deployment

Run ID:

`34171820888`

Result:

**SUCCESS**

The same workflow validates syntax and tests before creating the Pages artifact, then deploys only after the build job succeeds.

## Chromium browser smoke

Run ID:

`34171820880`

Result:

**SUCCESS**

This is important: the browser suite now tests actual runtime behavior instead of only parsing modules.

The current smoke scenarios cover:

1. Phase boots cleanly.
2. Responsive controls remain contained at desktop and compact workstation viewport sizes.
3. The locally generated procedural demo loads through the real audio decode/file path.
4. Demo workflow completes:
   - DEMO
   - ANALYZE
   - ALIGN B → A
   - confirm visual changes pending
   - RENDER CHANGES
   - return to AUDIO CURRENT
   - PLAY / STOP
5. HELP opens.
6. DIAG opens.
7. STEMS opens.
8. Standalone recovery route loads.
9. Lifecycle/pagehide persistence stores a Phase v12 project map.
10. Chromium is switched fully offline.
11. The Phase application relaunches from the service-worker shell offline.
12. `recovery.html` also loads offline and sees the persisted session.

This is one of the strongest current release-readiness signals.

---

# 6. Product identity / visual direction

Product name:

**EchoVerse Phase**

Subtitle / family framing:

**EchoVerse Audio Workstation**

UI direction is settled:

- dark, calm, professional workstation
- near-black / charcoal primary surfaces
- muted teal Phase accent: `#66b5a8`
- restrained waveform/downbeat blue
- gold for selection / pending / alignment emphasis
- glow only where selection or active state warrants it
- dense enough to feel like a workstation, but not visually noisy
- no aviation/wings imagery despite AeroVista ownership
- hierarchy and workflow clarity over decorative branding

The current UI is already aligned with that direction and should be refined rather than replaced wholesale.

---

# 7. Product architecture

Settled architecture:

```text
GitHub: aerovista-us/phase
        │
        ▼
    GitHub Pages
      Phase PWA
        │
        ├── Browser/local core
        │     - Web Audio
        │     - waveform / markers
        │     - analysis
        │     - edit model
        │     - render worker
        │     - project/session model
        │     - export
        │
        └── Optional heavy worker later
              NXCore / Linux
              - stem separation
              - other heavyweight DSP if justified
```

### Architectural principle

**Source audio is immutable.**

Phase stores editing intent instead of rewriting source files.

That includes:

- detected/corrected beat grid
- downbeats
- meter
- alignment markers
- warp target times
- pitch
- placement
- trims
- selected regions
- fades/crossfades
- mix metadata
- stem routing metadata

Visual edits should remain immediate. Expensive audio transformation stays behind explicit `⚡ RENDER CHANGES`.

---

# 8. Core user interaction contract

The original product behavior remains a hard requirement.

## Analysis gives a starting point, not authority

Automatic analysis can be wrong.

The system must always preserve first-class manual correction for:

- BPM octave errors
- meter
- downbeat / Bar 1
- beat marker timing
- alignment point selection
- phrase placement

## Marker semantics

Conceptually:

```text
┃ = downbeat / beat 1
│ = ordinary beat
▼ = phrase / structure marker where applicable
🔒 = locked warp anchor
```

Current UI represents these through styled markers rather than relying only on literal glyphs.

## Warp rule

Warp editing is intentionally regional.

When a later marker is dragged:

- find the previous locked anchor
- keep everything before that anchor unchanged
- stretch/compress only the region between the anchor and dragged marker
- redistribute timing smoothly through that region
- shift later timing consistently after the edited section

The source audio remains unchanged until render.

## Grid correction vs warp

These are separate concepts.

**GRID EDIT** fixes the detector marker in source-time without creating an audio stretch.

**WARP** changes target timing and therefore may require DSP.

That separation is fundamental to Phase's usability.

---

# 9. Current workstation modes and controls

Primary edit modes:

- SELECT
- WARP
- ANCHOR
- GRID EDIT
- MOVE
- REGION

Core shortcuts include:

- `W` — Warp
- `A` — Anchor
- `G` — Grid Edit
- `M` — Move track
- `R` — Region
- `I` — Set trim IN at playhead
- `O` — Set trim OUT at playhead
- `Space` — play/stop
- `L` — loop
- `+` / `-` — timeline zoom
- `Shift + click marker` — redefine Bar 1/downbeat phase
- `Shift + drag` — bypass snap where supported
- `?` — Help
- `Esc` — return toward SELECT / close active drawers

---

# 10. Timeline / arrangement state

Phase uses one true shared project timeline.

Each track has independent source duration and placement, but the visual project uses a shared `state.viewDuration` and `state.pxPerSecond`.

Important track placement fields:

```js
timelineOffset   // live/edit placement
renderedOffset   // last committed audio placement
```

This preserves a central Phase principle:

> visual edits can change immediately without lying about the audio currently being heard.

Until `RENDER CHANGES` commits the edit, playback remains based on the last completed render/placement state where required.

## Zoom

Zoom changes pixels-per-second only; project time itself does not change.

Current bound:

approximately `5–28 px/s`.

## Snap

Current placement/region snap options include:

- beat
- bar
- 8 bars
- 16 bars
- 32 bars
- off

Bar/phrase math follows current meter.

---

# 11. Analysis / musical intelligence

Current `js/analysis.js` foundation includes:

- broadband transient energy
- low-frequency/kick-sensitive energy
- high-frequency transient contribution
- BPM estimation
- tempo confidence
- downbeat phase
- downbeat confidence
- beat list
- key estimation
- key root/mode/confidence
- meter support

Current meter workflow supports:

- 3/4
- 4/4
- 6/8

Phase also supports half/double BPM correction without throwing away the detected grid.

## Key compatibility

`MATCH KEY B → A` uses relative-key normalization and calculates a compact semitone correction.

Example principle:

A minor and C major are treated as harmonically compatible before applying unnecessary pitch movement.

## Match Assist

Compatibility logic scores:

- key relationship
- tempo relationship
- meter compatibility

Pair suggestions are **advisory**.

They may set candidate A/B alignment markers but must not silently move/render the audio.

---

# 12. Phrase / alignment workflow

The arrangement workflow is now intentionally phrase-aware.

Each track has an explicit chosen alignment marker.

Alignment no longer has to mean "first detected downbeat to first detected downbeat."

The user can choose musically meaningful A/B points and then align them.

Follower alignment uses the master's **actual edited target grid**, not simply an average BPM number.

This matters because manually corrected/warped Track A remains authoritative for alignment after the user edits it.

---

# 13. Playback / mix model

Current playback has been superseded by the richer `mix-ui.js` path.

Important capabilities:

- track MUTE
- track SOLO
- LEVEL / gain
- stem-aware playback
- trim-aware playback
- fade-aware playback
- playhead seeking
- audition around alignment
- loop playback

### Important ownership note

`js/app.js` still contains original/core handlers, but richer UI modules override several handlers after load.

For example, `mix-ui.js` owns the modern playback/render/export path.

When changing behavior, inspect final handler ownership before editing the old implementation in `app.js`.

---

# 14. Render architecture

## User-visible state contract

Key states:

- `AUDIO CURRENT`
- `VISUAL CHANGES PENDING`
- `RENDERING`
- completion/error/cancel states

## Render quality

Current quality modes:

- FAST
- BALANCED
- HIGH

Changing render quality can invalidate the prior render if DSP edits exist.

## Core DSP

`js/render-core.js` implements browser-local time/pitch processing.

The current algorithm is custom granular / overlap-add style DSP.

Important behavior:

- target duration follows warp map
- time stretch approximately preserves pitch
- pitch can be shifted separately from duration
- clean PCM can be preserved outside dirty timing regions
- sparse/dirty region processing avoids unnecessary grain work

This is a good alpha engine but should **not** be described as studio-grade Rubber Band quality yet.

Real-music profiling/tuning remains valuable before 1.0.

## Render reuse

Rendered audio can be reused for placement-only changes where the DSP signature did not change.

Warp or quality changes invalidate it appropriately.

---

# 15. Stem architecture

Phase has a canonical four-stem model:

- vocals
- drums
- bass
- other

Manual stem loading works today.

Per-stem controls include:

- LEVEL
- MUTE
- SOLO

Stem playback/render/export follows the parent track's:

- timing grid
- warp map
- pitch
- placement
- trim
- fades

The original full mix remains the analysis/grid authority.

## Optional stem provider client

The browser-side HTTP provider contract is implemented in `js/stem-provider.js`.

Canonical preset:

`4stem`

### Job creation

Phase sends multipart form data to:

```text
POST <endpoint>/v1/stem-jobs
```

Fields:

- `audio` — original source file
- `preset` — currently `4stem`
- `trackLabel` — optional

Provider should return a job `id` and/or `statusUrl`.

### Polling

Default status URL pattern:

```text
GET <endpoint>/v1/stem-jobs/<jobId>
```

Expected states include queued/running and a completed state.

Progress is expected as a normalized `0..1` value.

### Completion payload

Expected logical shape:

```json
{
  "status": "complete",
  "stems": {
    "vocals": { "url": "...", "fileName": "vocals.wav" },
    "drums":  { "url": "...", "fileName": "drums.wav" },
    "bass":   { "url": "...", "fileName": "bass.wav" },
    "other":  { "url": "...", "fileName": "other.wav" }
  }
}
```

String URLs are also accepted for individual stem entries.

The client downloads the returned blobs and decodes them locally.

Cancellation via `AbortController` is supported.

### Remaining external dependency

There is **no authoritative deployed NXCore/Demucs separator service in the AeroVista GitHub organization yet** based on the repo search performed in this session.

The client boundary is ready; the actual worker is the major remaining integration task.

Do not redesign the browser client contract unless the backend implementation gives a concrete reason.

---

# 16. Resource / memory preflight

Phase now estimates audio-memory pressure before unusually large operations.

Modules:

- `js/resource-preflight.js`
- `js/resource-preflight-ui.js`

It estimates:

- resident decoded audio memory
- active source/stem buffers
- likely output expansion from warp duration
- temporary render working memory
- estimated separation memory footprint

Thresholds are device-aware when `navigator.deviceMemory` is available.

Normal sessions remain silent.

Only caution/severe projections prompt the user before continuing.

This is deliberately a preflight warning rather than an absolute guarantee because browser memory availability is not perfectly observable.

---

# 17. Project / session persistence

Current project schema:

**v12**

Defined in:

`js/project-model.js`

Project files preserve edit intent and metadata, not audio bytes.

Important project data includes:

- app/version/saved timestamp
- project BPM
- meter/meter preference
- beats-per-bar
- view duration / zoom
- snap mode
- playhead
- loops
- selected region
- per-track source metadata
- source BPM
- pitch
- placement
- trim
- fades
- grid mode
- alignment marker
- gain/mute/solo
- stem metadata
- analysis summary
- marker list

## Compatibility

Current rules:

- current v12 accepted
- older Phase maps accepted as legacy when structurally valid
- missing version is treated as legacy v1
- future schema versions are refused safely
- non-Phase maps are rejected

## Autosave / lifecycle persistence

Session key:

`echoverse.phase.session.v5`

Phase persists metadata/project state during normal operation and explicitly on page lifecycle transitions.

Lifecycle hooks include:

- pagehide
- hidden
- freeze
- close-related transitions where supported

The Chromium smoke suite now proves that the generated demo persists as a v12 session and remains visible through offline recovery.

---

# 18. Project packaging / relinking

## SAVE MAP

Stores the normal project/edit map.

## SAVE PACKAGE

Creates a normal Phase project plus explicit source/stem asset manifest metadata.

Audio bytes remain external intentionally.

## Relinking

Phase stores lightweight identity data:

- filename
- size
- type
- modified time

Relinking strongly prefers the correct matching source and can distinguish:

- same-name different-size conflicts
- modified-time drift
- duplicate filename candidates

Automatic restore blocks unsafe same-name identity conflicts rather than blindly applying an old edit map to a different file.

---

# 19. Diagnostics / support / recovery

## DIAG

Diagnostics cover:

- browser/Web Audio capability
- worker/runtime support
- PWA/storage state
- local persistence health
- saved-map size/schema/time
- decoded-audio memory
- grid health
- render state
- stems
- boot timing
- deployed build identity
- stale-build detection

## Runtime guard

Phase maintains a local runtime event/error ring buffer.

## Support snapshot

Metadata-only support snapshots can be exported.

A redacted variant can omit source/stem filenames.

Audio bytes are not included.

## Standalone recovery page

`recovery.html` deliberately does **not** import the workstation module graph.

It can inspect:

- saved local session
- deployed build metadata
- validation status
- build channel
- workflow ID
- runtime history
- service workers
- Phase caches
- secure context / online state

Recovery actions include:

- open Phase
- download saved project map
- download recovery report
- clear runtime log
- refresh status
- reset app cache + service worker

Resetting the application shell intentionally keeps the saved Phase project map.

---

# 20. PWA / offline behavior

Phase is an installable PWA.

Service worker:

`sw.js`

Current cache:

`echoverse-phase-shell-v41`

The full JS module graph is included in the offline shell and statically checked by CI.

## Network-first dynamic resources

Navigation, scripts, CSS, HTML, and `build.json` use network-first behavior so alpha builds refresh aggressively.

## Important cache-bust fix completed

`index.html` loads modules/styles using cache-bust query strings such as:

`?v=1280`

The service-worker precache stores canonical paths without those query strings.

A real offline edge case was identified and fixed in this session by making cache fallback use:

```js
caches.match(request,{ignoreSearch:true})
```

This means an offline request for:

`app.js?v=1280`

can correctly resolve the precached:

`app.js`

The Chromium suite now proves offline relaunch after this fix.

---

# 21. Startup / optional UI loading

Phase uses staged startup.

The core editor loads first.

Secondary surfaces load during idle/first-paint window through `js/optional-ui.js`.

Current optional UI includes:

- DEMO
- STEMS
- DIAG
- SUPPORT
- HELP
- resource preflight UI

Pressing `?` forces help loading immediately instead of waiting for idle.

Boot timing is captured so startup can be measured rather than guessed.

---

# 22. Performance budgets

CI now protects basic static-size budgets.

Current test limits:

- critical direct module entrypoints: **≤ 256 KB**
- all Phase JavaScript source: **≤ 512 KB**
- core styles: **≤ 128 KB**
- standalone recovery page: **≤ 64 KB**

These are source-size budgets, not network-compression benchmarks.

Their purpose is to stop quiet code growth from reintroducing startup instability.

---

# 23. Procedural demo

Phase includes an entirely original generated two-track demo.

Module:

`js/demo-audio.js`

It creates deterministic stereo WAV audio locally.

Current demo defaults used by the UI:

- Track A: ~100 BPM
- Track B: ~104 BPM
- 8 bars in the demo loader
- generated locally
- no network source
- no copyrighted demo recording

The demo intentionally enters through the same local File/decode path as user audio so it is useful as a real integration test.

The browser CI depends on this and now uses it to validate the full editor workflow.

---

# 24. Test architecture

## Node model/unit suite

Command:

```bash
npm test
```

Current verified total:

**134 passed / 0 failed**

## Syntax gate

Command:

```bash
npm run check
```

It explicitly runs `node --check` across the Phase module list.

## Static shell integrity

`tests/static-shell.test.mjs` checks, among other things:

- index references exist
- service-worker assets exist
- every JS module is offline-capable
- literal relative imports resolve
- Pages artifact contains required assets
- Pages deployment remains syntax/test gated
- build metadata is generated
- build metadata is network-first
- cache-busted offline lookup is protected
- visible version/cache generation stay consistent
- runtime/session guards load before the editor
- recovery route contains required support controls

## Browser smoke

Workflow:

`.github/workflows/browser-smoke.yml`

Test file:

`tests/e2e/phase.smoke.spec.mjs`

Runs Playwright Chromium against a local static server in GitHub Actions.

This avoids dependence on the public custom domain for functional QA while still testing a real browser environment.

---

# 25. Important current code ownership map

This codebase grew incrementally. Several newer modules supersede original `app.js` handlers.

Do not assume the first function matching a behavior is the final runtime owner.

### Core / initial editor

- `js/state.js`
- `js/audio.js`
- `js/analysis.js`
- `js/warp.js`
- `js/app.js`

### Arrangement

- `js/arrangement.js`
- `js/arrange-ui.js`
- `js/phrase-model.js`
- `js/phrase-ui.js`
- `js/tempo-model.js`
- `js/tempo-ui.js`

### Mix/playback/render ownership

- `js/mix-ui.js`
- `js/source-model.js`
- `js/render.js`
- `js/render-core.js`
- `js/render-worker.js`
- `js/render-quality.js`
- `js/stem-render.js`

### Editing

- `js/region-model.js`
- `js/region-ui.js`
- `js/fade-model.js`
- `js/fade-ui.js`
- `js/trim-ui.js`

### Transport / export

- `js/transport-model.js`
- `js/transport-ui.js`
- `js/export-loop-ui.js`
- `js/export.js`

### Project/session

- `js/project-model.js`
- `js/project-ui.js`
- `js/project-package.js`
- `js/history-ui.js`
- `js/source-identity.js`
- `js/session-safety.js`

### Stems

- `js/stems.js`
- `js/stems-ui.js`
- `js/stem-provider.js`
- `js/stem-render.js`

### Productization/support

- `js/diagnostics.js`
- `js/diagnostics-ui.js`
- `js/runtime-guard.js`
- `js/support-snapshot.js`
- `js/support-ui.js`
- `js/help-ui.js`
- `js/accessibility-ui.js`
- `js/resource-preflight.js`
- `js/resource-preflight-ui.js`
- `js/demo-audio.js`
- `js/demo-ui.js`
- `js/optional-ui.js`

---

# 26. Known cleanup / technical debt

## A. Duplicate service-worker registration in `js/app.js`

There is still an old final registration in the original app module using root-relative:

```js
navigator.serviceWorker.register('/sw.js')
```

`index.html` already registers the correct relative worker:

```js
navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
```

On the custom-domain root, the duplicate root path is largely harmless.

On the GitHub Pages fallback `/phase/`, the old root-relative path is incorrect/redundant.

**Recommended cleanup:** remove the duplicate registration from `app.js` or change it to the same relative strategy. Prefer one registration owner.

This is not currently blocking the production custom domain or Chromium smoke suite, but it should be cleaned before 1.0.

## B. README release list is slightly stale

`README.md` still lists "deeper real-browser interaction QA" as remaining before 1.0.

That was materially advanced after the README update: the browser suite now covers full demo analysis/alignment/render plus lifecycle persistence and offline relaunch.

The next documentation pass should mark browser QA as substantially complete while noting that only Chromium is automated today.

## C. Cross-browser QA

Automated browser coverage is currently Chromium-centric.

Before 1.0, decide whether to require at least one Firefox/WebKit smoke pass or explicitly define Chromium/Edge/Chrome as the supported baseline for 1.0.

## D. Branch protection

`main` is not currently protected.

Deployment is gated, but direct pushes can still enter `main` without GitHub branch rules.

Before 1.0, strongly consider branch protection with required checks.

---

# 27. Known non-problems / settled decisions

Do not spend time re-solving these unless new evidence appears.

### Deployment

GitHub Pages is correct for the current static/local-first client.

### Audio source ownership

Source files remain local and immutable.

### Project file size

Project/package files should remain metadata/edit intent; do not embed full audio by default.

### Expensive DSP

Do not make waveform dragging synchronously run heavy DSP.

The explicit render boundary is intentional.

### Automatic analysis

Do not make detected tempo/downbeat/key silently authoritative.

Manual correction is a product feature, not a fallback hack.

### Stems

The client contract exists. The next problem is providing a real worker, not redesigning all stem UI.

### Heavy backend

NXCore/Linux should remain optional and focused on workloads that genuinely justify server/worker compute.

Do not move the entire Phase application server-side.

---

# 28. Remaining work before 1.0 — recommended priority

## P0 — Provision actual stem separation service

This is the clearest missing functional dependency.

Recommended worker shape:

```text
Phase browser
   │
   ├── POST /v1/stem-jobs
   │      source audio + 4stem preset
   │
   ▼
NXCore/Linux worker
   │
   ├── queued/running status
   ├── Demucs or chosen separator engine
   ├── temporary job storage
   └── output: vocals/drums/bass/other
   │
   ▼
Phase polls /v1/stem-jobs/:id
   │
   └── downloads stem WAVs
```

Requirements:

- bounded upload size
- cleanup/TTL for source and output artifacts
- job IDs not guessable if exposed beyond tailnet
- cancellation where practical
- explicit allowed origins/auth strategy
- progress reporting
- predictable WAV/PCM output
- no source retention beyond defined TTL

Choose whether the first deployment is:

1. tailnet-only NXCore endpoint, or
2. AeroVista-authenticated public worker.

For initial Phase use, tailnet/internal is likely simpler if the product is still alpha.

## P0/P1 — Real-track profiling

Use actual full-length music and DIAG evidence to measure:

- decode time
- analysis time
- memory footprint
- render time
- granular artifacts
- render cancellation
- full WAV export
- stem-heavy sessions

The current automated demo is excellent for deterministic regression but does not replace real music QA.

## P1 — Startup/signature sound

Still desired:

3–6 second original identity sound, conceptually:

- original "EchoVerse… Phase." vocal
- stereo phase/comb sweep
- beat snap
- clean sub impact

It should feel memorable in the spirit of classic media software startup identity without copying an existing sound.

Keep it optional/subtle enough not to become annoying on repeated launches.

## P1 — Final browser/support policy

Decide supported browser baseline and either:

- add Firefox/WebKit CI, or
- document Chromium-family requirement for 1.0.

## P1 — Release governance

Before stable 1.0:

- clean duplicate SW registration
- update README release checklist
- consider branch protection
- ensure all required Actions are green
- perform one final live custom-domain test
- validate build identity through DIAG/recovery

---

# 29. Recommended immediate next-session sequence

Use this order.

### Step 1 — Verify current head and Actions

Confirm `main` has not changed since:

`4fbfb7da0b92bcf0c56e1a9c60471071299290cc`

Then check:

- Phase checks
- Pages deploy
- browser smoke

Do not rely on the IDs in this handoff if newer commits exist.

### Step 2 — Clean the duplicate service-worker registration

Small, bounded cleanup before new backend work.

Run all three gates afterward.

### Step 3 — Update README release status

Mark deep Chromium/offline QA as completed/substantially complete.

Leave cross-browser testing as the remaining browser decision.

### Step 4 — Build/provision the stem worker

Prefer a new bounded worker/service rather than mixing a Python ML runtime into the static Phase repo.

Possible implementation technologies:

- Python FastAPI
- Demucs CLI/library
- queue with one or a small number of concurrent jobs
- systemd or Docker on NXCore/Linux

Keep the API compatible with `js/stem-provider.js` unless there is a compelling implementation problem.

### Step 5 — Test real song sessions

Load several real tracks with:

- close BPM
- large BPM difference
- strong vs ambiguous downbeats
- 3/4 or 6/8
- large pitch shift
- significant stretch
- stems enabled

Use DIAG measurements and record concrete quality/performance findings.

### Step 6 — Add startup signature

Do this after the main production workflow remains stable.

### Step 7 — Decide 1.0 gate

A reasonable 1.0 gate is:

- all Node tests green
- browser smoke green
- Pages deploy green
- live custom domain loads cleanly
- offline launch/recovery works
- project save/relink proven
- render/export proven on real songs
- stem service operational or explicitly declared post-1.0 optional
- browser support policy documented
- no known data-loss bugs
- no known severe render corruption bugs

---

# 30. Current release-readiness assessment

## Strong / validated

- local source import
- project timeline
- waveform/grid UI
- BPM/downbeat/key foundation
- meter handling
- manual correction
- alignment
- phrase snap
- placement
- trim/region/fades
- mix controls
- loops
- WAV export
- local granular render
- render reuse/cancel/quality modes
- stems client model
- manual stems
- stem playback/render/export
- project persistence
- relinking
- project package
- diagnostics
- recovery
- PWA/offline shell
- cache-bust-safe offline relaunch
- lifecycle persistence
- static integrity tests
- unit/model tests
- real Chromium smoke tests
- test-gated Pages deployment

## Still alpha / needs real-world evidence

- DSP quality on difficult full-length commercial music
- long-session memory behavior
- large multi-stem memory pressure
- exact browser compatibility outside Chromium
- actual separator service performance/reliability

## Missing external integration

- live NXCore/local stem separator endpoint

## Product polish still desired

- final startup/signature sound
- final release copy/docs cleanup
- branch/release governance hardening

---

# 31. Commands / checks for local development

Basic syntax:

```bash
npm run check
```

Unit/model/static tests:

```bash
npm test
```

Browser smoke dependencies/workflow are currently CI-oriented, but locally the equivalent is conceptually:

```bash
npm install --no-save @playwright/test@1.55.0
npx playwright install chromium
python3 -m http.server 4173 --bind 127.0.0.1
npx playwright test --config=playwright.config.mjs
```

The browser smoke workflow writes a temporary local `build.json` before starting the server because the real Pages artifact normally generates that file at deploy time.

---

# 32. Key version / state constants

At handoff:

```text
Visible Phase version:       0.12.8
Project schema:              12
Session key:                 echoverse.phase.session.v5
Service-worker cache:        echoverse-phase-shell-v41
Cache-bust generation:       1280
Primary domain:              phase.aerovista.us
Primary host:                GitHub Pages
Latest main SHA:             4fbfb7da0b92bcf0c56e1a9c60471071299290cc
Latest unit test count:       134 passed / 0 failed
Latest Phase checks run:      34171820887 · success
Latest Pages run:             34171820888 · success
Latest browser smoke run:     34171820880 · success
```

---

# 33. Final continuation instruction

The next session should treat Phase as a **working workstation being productized**, not as a prototype needing another architecture rewrite.

The browser/local foundation is now proven enough that the highest-value work is external capability and real-world quality evidence:

1. clean the small service-worker duplicate
2. update stale release documentation
3. provision the real stem separation worker
4. profile real music sessions
5. finish startup identity/polish
6. set and pass the final 1.0 release gate

Most importantly, preserve the product's defining behavior:

> **Analysis proposes. The user corrects. Visual edits stay instant. Source audio stays immutable. Expensive DSP happens only when Phase is explicitly told to render.**
