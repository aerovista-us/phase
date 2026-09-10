# EchoVerse Phase — Comprehensive Continuation Handoff

**Prepared:** 2026-09-10  
**Repository:** `aerovista-us/phase`  
**Live alpha:** `https://phase.aerovista.us/`  
**Current visible version:** **Phase 0.13.0**  
**Application baseline before this handoff commit:** `bf98617815a677a60d476a7024070dd6e7163a03`  
**Project schema:** `v12`  
**Service-worker shell:** `echoverse-phase-shell-v43`  
**Session storage key:** `echoverse.phase.session.v5`  
**Status:** pre-release-candidate alpha; core browser workflow, automatic audio preview, persistence, recovery, offline relaunch, diagnostics, deployment and browser smoke are working and automated.

---

# 1. Purpose of this handoff

This document is the authoritative continuation handoff for the current EchoVerse Phase build. It supersedes the older 0.12.8 continuation assumptions where they conflict with the current repository.

The most important architectural change since the previous handoff is the move from:

> visual edits are instant, but expensive DSP happens only after the user explicitly presses Render

to the more mature workstation model:

> **source audio stays immutable; edits project immediately; Phase automatically creates disposable background audio previews when needed; explicit rendering remains the final-quality/current-output path; export guarantees final-current audio.**

That change is implemented in Phase 0.13.0 and is no longer merely a proposal.

Repository contents remain the source of truth. When resuming work, read this handoff first, then inspect the current files before changing code because the repo may have advanced after this document was prepared.

## Recommended read order for the next session

1. `docs/PHASE_COMPREHENSIVE_HANDOFF_2026-09-10.md`
2. `README.md`
3. `index.html`
4. `js/state.js`
5. `js/mix-ui.js`
6. `js/render.js`
7. `js/render-core.js`
8. `js/stem-render.js`
9. `js/source-model.js`
10. `js/project-model.js`
11. `js/project-ui.js`
12. `js/history-ui.js`
13. `js/readiness-ui.js`
14. `js/diagnostics.js`
15. `js/diagnostics-ui.js`
16. `js/session-safety.js`
17. `js/stem-provider.js`
18. `sw.js`
19. `.github/workflows/test.yml`
20. `.github/workflows/pages.yml`
21. `.github/workflows/browser-smoke.yml`
22. `tests/e2e/phase.smoke.spec.mjs`

Before doing implementation work, inspect the latest `main` commit and current GitHub Actions. Do not assume the run IDs in this document are still the newest if the repository has moved.

---

# 2. Executive status

Phase has moved far beyond the original static `cuts.html` experiment. It is now a real local-first browser/PWA audio workstation with:

- local source import and Web Audio playback
- shared timeline and playhead
- BPM / beat / downbeat / key analysis
- 3/4, 4/4 and 6/8 meter handling
- first-class manual correction
- explicit A/B musical alignment points
- piecewise warp anchors and grid correction
- track placement and phrase snap
- separate pitch adjustment
- nondestructive IN / OUT trim
- regions, loops, fades and crossfades
- MUTE / SOLO / LEVEL
- local granular render worker
- dirty-region DSP and PCM preservation
- FAST / BALANCED / HIGH quality
- **automatic disposable FAST audio preview after edit settle**
- **explicit final-quality render**
- stem-aware playback/render/export
- optional remote/local stem provider client
- project save/load, lifecycle autosave and relinking
- package/asset manifest workflow
- Undo / Redo
- diagnostics and support snapshots
- standalone recovery route
- offline/PWA relaunch
- deployed build identity and stale-build detection
- production-readiness rail
- resource/memory preflight
- bundle/startup budgets
- test-gated GitHub Pages deployment
- real Chromium workflow testing

The current product is best described as **pre-release-candidate alpha**. The architecture is no longer the main uncertainty. Remaining work is concentrated around real-music/device QA, external stem-separator provisioning, final quality tuning and product polish.

---

# 3. Current authoritative repository and release state

## Repository

`aerovista-us/phase`

Default branch:

`main`

Application baseline immediately before this handoff was created:

`bf98617815a677a60d476a7024070dd6e7163a03`

Commit title:

`Phase 0.13 production readiness and UI status rail`

That merge added or finalized:

- production-readiness rail
- workstation readiness UI
- readiness rail polish
- successful session persistence announcements
- offline caching of readiness UI
- scored runtime performance profile
- performance-profile tests
- performance readiness in diagnostics
- Chromium proof for readiness UI
- Phase 0.13 product/readiness documentation

### Branch governance

At the last checked state, `main` is **not branch protected** and GitHub reports required status-check enforcement off.

This does not mean deployment is unvalidated: the custom Pages workflow itself runs syntax and full tests before publishing. However, branch protection and deployment gating are separate controls. Before 1.0, consider protecting `main` and requiring the core checks if the workflow/repository permissions permit it.

---

# 4. Hosting and deployment

## Settled deployment path

Primary hosting is **GitHub Pages**.

Custom domain:

`phase.aerovista.us`

The repo contains a `CNAME` file and the Pages build preserves it.

The old Vercel path is not the production mechanism and should not be reintroduced as the critical path without a specific reason. Earlier Vercel deployment attempts were unreliable in the connected environment, while GitHub Pages became stable and is now covered by deployment integrity tests.

## Pages build behavior

`.github/workflows/pages.yml` is test-gated. The workflow performs, in order:

1. checkout
2. Node setup
3. `npm run check`
4. `npm test`
5. Pages configuration
6. static artifact construction
7. `build.json` generation
8. artifact upload
9. Pages deploy

The static bundle contains the workstation shell, recovery route, CSS, manifest, service worker, icons, JavaScript modules and CNAME.

Generated `build.json` includes at least:

```json
{
  "version": "0.13.0",
  "commit": "<GITHUB_SHA>",
  "builtAt": "<UTC ISO timestamp>",
  "validated": true,
  "channel": "alpha",
  "workflowRun": "<GITHUB_RUN_ID>"
}
```

`build.json` is intentionally treated network-first so Phase can detect stale installed/cached builds.

### Production verification language

GitHub Actions verifies successful Pages deployment. Do not claim a fresh interactive browser test of `phase.aerovista.us` unless one was actually performed. The automated Chromium suite runs against the repository through a local static server and gives strong runtime proof, but it is not identical to manually testing the custom-domain production instance.

---

# 5. Exact latest verified release gates

For application baseline `bf98617815a677a60d476a7024070dd6e7163a03`:

## Phase checks

Run ID:

`34253249708`

Result:

**SUCCESS**

The job completed both:

- `npm run check`
- `npm test`

Latest verified Node/model/static suite:

**138 tests passed / 0 failed / 0 skipped / 0 cancelled**

The suite includes coverage for:

- beat/downbeat analysis
- meter scoring
- key analysis
- phrase snap
- selected-marker alignment
- placement math
- compatibility scoring
- demo audio generation
- diagnostics
- production performance profile
- trim/fade/region behavior
- render quality
- dirty-region rendering
- pitch and timing behavior
- render reuse
- preview-vs-final semantics
- memory/resource preflight
- project schema and package format
- session safety
- source identity/relinking
- stem routing
- stem provider HTTP contract
- support snapshots
- transport
- static shell integrity
- offline JavaScript module availability
- service-worker cache-bust behavior
- deployment gating
- build metadata invariants
- runtime/lifecycle boot ordering

## Browser smoke

Run ID:

`34253249711`

Result:

**SUCCESS**

Current Playwright/Chromium smoke proves four major scenarios:

1. **Automatic preview + explicit final workflow**
   - Phase boots
   - DEMO loads
   - both tracks decode through the real load path
   - ANALYZE completes
   - ALIGN B → A changes the edit map
   - Phase enters audio-preview state
   - automatic preview reaches `AUDIO PREVIEW CURRENT`
   - button becomes `RENDER FINAL`
   - playback identifies itself as PREVIEW
   - explicit final render returns to `AUDIO CURRENT`
   - HELP, DIAG and STEMS drawers work
   - no uncaught browser errors

2. **Lifecycle persistence + fully offline relaunch**
   - service worker controls page
   - DEMO loads
   - `pagehide` persistence executes
   - project schema v12 is in localStorage
   - source identities are present
   - Chromium network is disabled
   - Phase reloads offline
   - recovery route loads offline
   - saved session remains visible

3. **Compact workstation containment**
   - 1024×650 viewport
   - topbar/modebar do not horizontally overflow
   - track-header children remain inside track headers
   - no uncaught errors

4. **Standalone recovery route**
   - route loads independently of workstation modules
   - build version resolves to 0.13.0
   - validated build flag is visible
   - recovery report action is available

## GitHub Pages deployment

Run ID:

`34253249664`

Result:

**SUCCESS**

The custom deployment workflow passed its own syntax/tests and completed Pages deploy for the exact application baseline.

---

# 6. Product identity and visual direction

Product name:

**EchoVerse Phase**

Family framing:

**EchoVerse Audio Workstation**

The visual language is settled enough that future work should refine it rather than replace it:

- dark professional workstation
- charcoal / near-black surfaces
- Phase accent teal `#66b5a8`
- restrained waveform/downbeat blue
- gold for selection, alignment or pending emphasis
- glow only for active/selected elements
- compact professional density
- strong information hierarchy
- no aviation or wing motifs simply because AeroVista owns the project
- functional workstation first, branding second

Phase 0.13 adds a compact production-readiness rail between the mode bar and main workspace.

Current rail categories:

- **AUDIO**
- **SESSION**
- **BUILD**
- **PERF**
- **OPEN DIAG** action

This rail should remain compact. It is a status surface, not a second dashboard.

---

# 7. Updated architectural principle — do not regress this

The previous architecture intentionally required explicit rendering for expensive DSP. That was a good safe foundation, but Phase 0.13 deliberately evolved it.

The current official architecture is:

> **Source audio is immutable. The project/edit map is authoritative. UI edits project immediately. Cheap changes apply directly. Expensive timing/pitch transformations debounce into cancellable disposable background previews. Explicit render remains the final-quality/current-output operation. Export guarantees final-current audio.**

This is the key product rule going forward.

## Three processing tiers

### Tier 1 — immediate / cheap

Operations that can update playback without expensive DSP should remain effectively immediate:

- gain / level
- mute / solo
- fades
- trim
- track placement when no DSP needs regeneration
- region/loop metadata
- other mix-only metadata

### Tier 2 — automatic disposable audio preview

DSP-affecting edit-map changes, such as warp/pitch-related timing transformations, schedule a background preview after editing settles.

Current implementation:

```text
edit occurs
    ↓
markDirty()
    ↓
phase:render-dirty event
    ↓
700 ms debounce
    ↓
resource preflight
    ↓
FAST background render if needed
    ↓
AUDIO PREVIEW CURRENT
```

Important properties:

- preview is derived/cache audio, never source mutation
- preview is cancellable
- rapid subsequent edits supersede the prior preview
- edit revision protects against stale preview completion
- FAST is the automatic preview quality
- if currently rendered audio already satisfies the edit and is higher quality, it is reused rather than needlessly downgraded
- memory caution can pause automatic preview rather than pressure the browser
- failure of automatic preview does not destroy the final-render path

### Tier 3 — explicit final render

`⚡ RENDER FINAL` makes the audio current at the selected final quality.

Current final quality options remain:

- FAST
- BALANCED
- HIGH

Final render:

- supersedes/cancels disposable preview work
- uses the selected quality
- preserves the existing dirty-region optimization
- leaves the source untouched
- returns the main state to `AUDIO CURRENT`

### Export contract

WAV export is strict:

> if the project is still final-render dirty, Phase first executes the explicit final-current path, then exports.

A disposable FAST preview is sufficient for auditioning, but it is not silently treated as the promised final-quality export when a different final quality is selected.

---

# 8. Current audio/render state machine

Core `state` now tracks:

```js
dirty
previewCurrent
previewRendering
dirtyRevision
rendering
```

Key UI transitions are conceptually:

```text
AUDIO CURRENT
    |
    | render-affecting edit
    v
EDIT LIVE · AUDIO PREVIEW CATCHING UP
    |
    | debounce starts worker
    v
EDIT LIVE · RENDERING AUDIO PREVIEW
    |
    | preview complete
    v
AUDIO PREVIEW CURRENT · FINAL RENDER AVAILABLE
    |
    | user presses RENDER FINAL or export requires final
    v
FINAL RENDER
    |
    v
AUDIO CURRENT
```

The distinction is important:

- `dirty=true` now primarily means **final-quality/current render is pending**
- it does **not** necessarily mean the user cannot hear the current edit
- `previewCurrent=true` while dirty means the current edit has an auditionable derived preview

Diagnostics and readiness surfaces have been updated to recognize this distinction.

---

# 9. Playback behavior under the new model

Modern playback is owned by `js/mix-ui.js` and related source-routing modules, not solely the older core handlers in `js/app.js`.

Playback must continue to behave sensibly throughout preview generation:

- when no new preview is ready, editing remains responsive
- existing completed audio can continue to play while preview catches up
- once preview is current, playback uses the derived preview
- UI should identify preview playback as `PREVIEW`
- final render is not required after every edit just to audition the change
- explicit final render remains available at all times when final-current audio is pending

`AUDITION ALIGN` prioritizes getting a preview current if required before playing the alignment window.

If preview generation cannot safely proceed due to memory/resource caution, Phase can pause automatic preview and instruct the user to use final render when ready rather than risking instability.

---

# 10. Core user workflow

The intended modern workflow is now:

```text
LOAD
  ↓
ANALYZE
  ↓
CORRECT BPM / METER / BAR 1 / GRID IF NEEDED
  ↓
CHOOSE MUSICAL A/B ALIGN POINTS
  ↓
ALIGN / MOVE / PHRASE SNAP
  ↓
WARP / GRID-CORRECT / PITCH / TRIM / REGION / FADE
  ↓
AUTOMATIC AUDIO PREVIEW
  ↓
AUDITION / ITERATE WITHOUT MANUAL RENDER EACH TIME
  ↓
OPTIONAL RENDER FINAL WHEN USER WANTS GUARANTEED SELECTED QUALITY
  ↓
EXPORT WAV (FORCES FINAL-CURRENT AUDIO FIRST)
```

This is the desired DAW-like interaction model.

---

# 11. Analysis and musical intelligence

Analysis remains advisory, not authoritative.

Current capabilities include:

- BPM estimation
- tempo confidence
- beat grid
- downbeat phase
- downbeat confidence
- key/root/mode estimation
- key confidence
- meter scoring
- 3/4 support
- 4/4 support
- 6/8 support
- phrase/section novelty suggestions
- previous/next phrase navigation
- half/double BPM correction

## Manual correction is non-negotiable

The user must remain able to override automatic conclusions.

First-class corrections include:

- source BPM
- half/double-tempo mistakes
- meter
- Bar 1/downbeat phase
- individual beat/source marker timing
- selected alignment markers
- warp anchors
- phrase placement

Automatic analysis should never trap the user inside an incorrect grid.

## Match Assist

Current mashup compatibility considers:

- harmonic/key relationship
- tempo relationship
- meter compatibility

Relative major/minor relationships are normalized so compatible pairs are not needlessly pitch-shifted.

Pair suggestions are advisory. They may propose/set candidate align points but must not silently move audio or commit DSP.

---

# 12. Arrangement, alignment and warp semantics

## Shared project timeline

Both tracks share project timeline/view state.

Each track has independent source content but uses common project time and zoom.

Important placement distinction:

```js
timelineOffset   // current edit-map placement
renderedOffset   // placement associated with completed derived audio
```

The 0.13 preview scheduler can synchronize cheap placement without forcing expensive DSP.

## Warp model

The core behavior remains regional and anchor-based.

Conceptual anchor type:

```ts
type WarpAnchor = {
  markerId: string
  sourceTimeSec: number
  targetTimeSec: number
  locked: boolean
  source: 'auto' | 'manual'
}
```

Dragging a warp marker should:

- find the previous locked anchor
- preserve everything before that anchor
- stretch/compress only the region between the prior lock and dragged marker
- redistribute intermediate target times evenly/smoothly through the region
- shift later target timing consistently

## Grid correction is different from warp

`GRID EDIT` changes detector/source timing for a marker without intentionally stretching the audio around it.

This separation is central:

- **grid correction** = detector was wrong
- **warp** = audio timing should change

Do not merge these operations into one ambiguous drag behavior.

## Alignment

The user chooses meaningful A/B alignment points.

Follower alignment should follow Track A's actual edited target grid, not simply a single average BPM number.

This means user-corrected master timing remains authoritative.

---

# 13. Editing modes and keyboard contract

Primary modes currently include:

- SELECT
- WARP
- ANCHOR
- GRID EDIT
- MOVE
- REGION

Important keyboard behavior:

- `W` — Warp
- `A` — Anchor
- `G` — Grid Edit
- `M` — Move
- `R` — Region
- `I` — Set IN trim
- `O` — Set OUT trim
- `Space` — play/stop
- `L` — loop
- `Left` / `Right` — beat seek
- `Home` — project start
- `+` / `=` — zoom in
- `-` — zoom out
- `Shift + click marker` — redefine Bar 1/downbeat phase
- `Shift` during applicable move/region drag — bypass snap/free placement
- `Esc` — return toward SELECT / close drawers
- `?` — help
- standard Undo/Redo shortcuts through history module

Marker semantics remain conceptually:

```text
┃ = downbeat / beat 1
│ = ordinary beat
▼ = phrase/structure marker where shown
🔒 = locked anchor
```

---

# 14. Nondestructive arrangement editing

Current editing features include:

- whole-track placement
- selected align points
- phrase snap
- IN trim
- OUT trim
- REGION selection
- Region → Loop
- Fade In
- Fade Out
- A→B crossfade
- gain/mute/solo

Source files are never rewritten.

Trim is output/timeline metadata, not a destructive edit of the imported file.

Existing export semantics intentionally preserve clip placement. An IN trim does not automatically slip the retained material back to project time zero unless a separate slip-edit feature is explicitly designed later.

---

# 15. Render engine

Core DSP is browser-local.

Important files:

- `js/render-core.js`
- `js/render.js`
- `js/render-worker.js`
- `js/render-quality.js`
- `js/stem-render.js`

Current behavior includes:

- piecewise timing map
- pitch-preserving-ish time stretch
- independent pitch shift
- dirty-region render planning
- original PCM preservation outside timing-changed regions
- render-boundary blending
- sparse grain work
- render statistics
- cancellation
- render reuse
- stem-aware render path

The algorithm is a custom granular/overlap-add style engine. It is good enough for current alpha development, but it should **not** be marketed as equivalent to a mature studio-grade time-stretch library such as Rubber Band until real-music QA supports that claim.

The right 1.0 path is to profile/tune the current engine against representative real tracks first. Replace it only if actual listening tests establish a quality ceiling that matters to the product.

---

# 16. Undo / Redo and preview interaction

History is metadata/edit-map based.

A subtle but important 0.13 behavior is already handled:

> mix-only history operations should not invalidate a perfectly valid timing/pitch preview simply because a final-quality render remains pending.

Render-affecting history changes should schedule a new preview; lightweight history changes should preserve usable preview audio when possible.

When modifying history logic, distinguish:

- edit-map changes that alter DSP fingerprint
- mix-only/trim/fade/placement changes that can remain cheap

Do not blindly map every Undo/Redo to `previewCurrent=false`.

---

# 17. Stem architecture

Phase uses four canonical stem slots:

- `vocals`
- `drums`
- `bass`
- `other`

Manual local stem loading works.

Stem controls include:

- MUTE
- SOLO
- LEVEL

Stem mode follows the parent track's edit model:

- timing
- warp
- pitch
- placement
- trim
- fades

The original mix remains the source-analysis/grid authority.

## Current external separator boundary

The **browser-side provider client already exists**. The missing piece is the actual deployed separator service.

Canonical preset:

`4stem`

### Create job

```http
POST <endpoint>/v1/stem-jobs
Content-Type: multipart/form-data
```

Fields:

- `audio` — source file
- `preset` — `4stem`
- `trackLabel` — optional

Provider must return at least a job `id` or a `statusUrl`.

### Poll status

Default convention:

```http
GET <endpoint>/v1/stem-jobs/<jobId>
```

Phase recognizes queued/running and terminal completion/error states.

Progress is normalized `0..1`.

### Completion

Logical payload:

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

String URLs are also tolerated for a stem entry.

Client behavior already includes:

- endpoint normalization
- multipart upload
- job polling
- progress callback
- error propagation
- cancellation
- canonical stem validation
- stem download
- generated local filenames

## Recommended next infrastructure milestone

Provision a real local/NXCore separator behind this existing contract instead of redesigning the browser client.

Likely implementation can use Demucs or an equivalent local model, but the service boundary should remain the stable Phase API contract so the separator implementation can evolve independently.

Keep the separator optional. Phase's core workstation must still launch and function without it.

---

# 18. Project model, persistence and package format

Current project schema:

**v12**

Local session key:

`echoverse.phase.session.v5`

The old storage-key suffix is intentionally retained for compatibility; do not rename it merely because the project schema is now v12.

Project snapshots preserve the meaningful edit state, including:

- project BPM
- project meter/meter preference
- zoom/view state
- placement
- trims
- regions/loops where applicable
- pitch
- gain/mute/solo
- analysis summary
- marker grid
- alignment state
- stems and stem mix metadata
- source identity/relink metadata

Audio bytes are intentionally not embedded into normal project saves.

## Source identity / relinking

Phase stores lightweight identity information such as:

- filename
- size
- MIME/type
- modified time

Relinking scores candidate files and warns on meaningful identity drift.

A same-named source with conflicting size should not silently receive an old edit map as though it were definitely the same source.

## SAVE PACKAGE

Project-package workflow writes a normal valid Phase map plus an explicit asset manifest.

The goal is lightweight handoff/archive:

- project/edit metadata inside package
- external source/stem assets listed explicitly
- no hidden duplication of large audio blobs

## Future schema compatibility

Current validation:

- accepts current maps
- accepts supported legacy maps
- treats missing version as legacy v1
- refuses unsupported future schemas safely
- rejects non-Phase maps

Preserve this defensive behavior.

---

# 19. Session safety and lifecycle persistence

Phase persists session metadata automatically.

Lifecycle safeguards include persistence around:

- normal autosave cadence
- page hide
- visibility transition
- freeze
- close/unload-adjacent lifecycle paths where supported

The readiness rail now reflects saved state and can surface stale persistence timing.

The Chromium suite proves `pagehide` persistence into the current session key before offline reload.

Do not store source audio blobs in localStorage just to make recovery easier. Phase's safety model is project-map persistence plus source relinking.

---

# 20. PWA and offline architecture

Current service-worker cache:

`echoverse-phase-shell-v43`

The core shell explicitly caches all required JavaScript modules, root assets and the recovery route.

The service worker is network-first for dynamic shell assets while the app is in alpha, including:

- navigation
- scripts
- styles
- HTML
- `build.json`

Offline fallback uses:

```js
caches.match(request,{ignoreSearch:true})
```

This is important because `index.html` uses cache-busting query strings such as `?v=1301`, while the offline shell may have canonical paths cached without those query strings.

The query-insensitive fallback prevents a first-session offline restart from missing its own precached JavaScript/CSS.

This behavior is covered both by static tests and Chromium offline relaunch.

---

# 21. Recovery and diagnostics

`recovery.html` deliberately does **not** load the full workstation module graph.

It is intended for cases where Phase itself cannot finish booting.

Recovery can inspect/report:

- saved session presence
- saved schema
- save timestamp
- track count
- deployed build identity
- validation flag
- release channel
- commit
- workflow run
- runtime history
- secure-context state
- online/offline state
- service-worker registrations
- Phase caches

Recovery actions include:

- open Phase
- download saved project map
- download metadata-only recovery report
- clear runtime log
- refresh state
- reset Phase app caches/service worker without intentionally deleting saved project map

## Diagnostics

DIAG covers:

- browser capability
- Web Audio
- OfflineAudioContext
- Web Worker
- secure context
- runtime/launch history
- boot timing
- deployed build/version/commit
- service worker and cache status
- local persistence health
- storage usage/quota
- decoded-audio memory
- resource caution threshold
- project tempo/meter
- edit/preview/final render state
- track/grid warnings
- separator configuration
- performance readiness

Support snapshots are designed to omit audio bytes and can redact filenames.

---

# 22. Production-readiness rail

Phase 0.13 introduces the always-visible readiness rail.

## AUDIO

Possible conceptual states:

- CURRENT
- PREVIEW CURRENT
- PREVIEW CATCHUP
- PREVIEW BUILD
- FINAL RENDER

## SESSION

Current logic distinguishes:

- READY
- SAVED
- SAVED · STALE
- UNSAVED
- STORAGE ISSUE

A saved session younger than roughly two minutes is considered fresh by the compact readiness surface.

## BUILD

The rail fetches network-first `build.json` and compares visible version to deployed version.

Conceptual states:

- LIVE
- UPDATE
- CHECKING
- OFFLINE
- UNKNOWN

A build is `LIVE` only when version matches and build metadata marks it validated.

## PERF

The compact rail uses real navigation/runtime timing signals.

Current threshold concept:

- `READY` — normal
- `WATCH` — DOM interactive over roughly 1.5 s or runtime-ready over roughly 3 s
- `PRESSURE` — DOM interactive over roughly 3 s or runtime-ready over roughly 5 s

DIAG contains the deeper scored performance profile and memory context.

Do not treat WATCH/PRESSURE as an automatic product failure. They are signals to profile representative hardware/workloads.

---

# 23. Resource and memory preflight

Before unusually expensive operations Phase estimates resident decoded audio plus temporary working memory.

Covered operations include:

- render
- automatic stem separation
- automatic preview scheduling safety

Classification exposes:

- ok
- caution
- severe

Thresholds can scale with `navigator.deviceMemory` where browsers expose it.

Desired UX:

- normal sessions remain silent
- unusually large work warns
- severe work asks before continuing where appropriate
- automatic preview may pause rather than destabilize the browser
- explicit final path remains available

---

# 24. Startup/performance discipline

Phase previously experienced a real launch-freeze class of failure, so startup discipline is a product requirement, not cosmetic optimization.

Current protections include:

- staged optional UI loading
- core workstation first
- secondary DEMO/STEMS/DIAG/HELP after first paint/idle window
- boot timing telemetry
- performance readiness
- static startup/bundle size budgets
- Chromium launch tests

Current CI performance-budget categories include:

- critical module entrypoint budget
- total Phase JavaScript budget
- core stylesheet budget
- standalone recovery route budget

Do not casually move heavyweight optional functionality into the critical boot path.

---

# 25. UI containment and responsive behavior

The workstation went through a dedicated containment pass after track controls began overflowing/clipping.

Important layout decision:

> keep the established track-header geometry rather than casually changing its width, because timeline/ruler/guide math assumes that geometry in multiple modules.

The UI now uses larger track rows, stacked/grid track-head controls, contained overflow, wrapped mode/top bars and compact responsive behavior.

Chromium smoke explicitly checks topbar, modebar and track-header containment at a compact 1024×650 viewport.

If future controls are added to the track rail, verify containment in the browser suite rather than only visually inspecting desktop width.

---

# 26. Original procedural DEMO

Phase includes a locally generated two-track synthetic demo.

Properties:

- original procedural audio
- no copyrighted demo recording
- no network request required
- loaded through the same real file/decode path as user audio
- deterministic test coverage

The demo is useful for automated workflow proof and first-run learning.

It is **not** the final EchoVerse Phase startup/signature sound.

---

# 27. Startup/signature sound — still pending

A short original branded Phase startup sound remains planned.

Direction previously discussed:

- approximately 3–6 seconds
- original `EchoVerse… Phase.` identity
- stereo phase/comb sweep
- beat snap
- clean sub hit
- memorable old-school software-demo character without copying another product

This should remain lightweight and should not delay workstation boot.

It is a product-polish milestone, not a reason to destabilize the core editor.

---

# 28. Module ownership map

The project evolved incrementally, so several newer modules intentionally supersede behavior that still exists in older core code.

When changing behavior, identify the final event/handler owner rather than editing the first matching function.

## Core state / shell

- `js/state.js` — global state and current dirty/preview/final state transitions
- `js/app.js` — original editor shell, waveform, load/analyze/core interactions; contains some legacy handlers/text that newer modules supersede

## Arrangement / workflow

- `js/arrangement.js` — arrangement math
- `js/arrange-ui.js` — richer alignment/move/grid workflow
- `js/visual-guides.js` — ruler/phrase/alignment guides
- `js/trim-ui.js` — IN/OUT trims
- `js/region-ui.js` — region selection
- `js/fade-ui.js` — fades/crossfades
- `js/transport-ui.js` — project playhead/loop transport behavior

## Audio rendering / playback

- `js/mix-ui.js` — **modern playback, automatic preview scheduler, explicit final render coordination and export preparation**
- `js/source-model.js` — eligible source/mix/stem routing
- `js/stem-render.js` — source/stem render orchestration and reuse state
- `js/render.js` — worker render/cancellation interface
- `js/render-worker.js` — background worker
- `js/render-core.js` — actual local DSP
- `js/render-quality.js` — quality parameters/signature behavior
- `js/export.js` — mix/WAV construction
- `js/export-loop-ui.js` — region/loop export

## Intelligence

- `js/analysis.js` — tempo/beat/downbeat/key foundation
- `js/tempo-model.js`, `js/tempo-ui.js` — tempo-octave correction
- `js/meter-ui.js` — meter controls
- `js/phrase-model.js`, `js/phrase-ui.js` — phrase suggestions/navigation
- `js/compatibility.js`, `js/compatibility-ui.js` — mashup Match Assist

## Project/session/recovery

- `js/project-model.js` — schema/snapshot/application
- `js/project-ui.js` — save/load/restore/relink UI
- `js/project-package.js` — asset manifest packaging
- `js/source-identity.js` — relink identity
- `js/history-ui.js` — Undo/Redo
- `js/session-safety.js` — lifecycle persistence
- `js/runtime-guard.js` — startup/runtime history
- `recovery.html` — independent recovery environment

## Stems

- `js/stems.js` — canonical stem state
- `js/stems-ui.js` — stem UI
- `js/stem-provider.js` — external separator client contract

## Diagnostics/readiness

- `js/diagnostics.js` — diagnostic report and performance profile data
- `js/diagnostics-ui.js` — diagnostic presentation
- `js/resource-preflight.js` / `resource-preflight-ui.js` — memory/work estimates
- `js/readiness-ui.js` — compact AUDIO/SESSION/BUILD/PERF rail
- `js/support-snapshot.js`, `js/support-ui.js` — support export

## Optional/startup

- `js/optional-ui.js` — staged optional module loading
- `js/demo-audio.js`, `js/demo-ui.js` — procedural demo
- `js/help-ui.js` — help drawer
- `js/accessibility-ui.js` — keyboard/focus/live announcement support

---

# 29. Known technical debt / documentation drift

These are not current release blockers, but the next session should know about them.

## A. README architectural sentence is stale

`README.md` correctly labels Phase 0.13.0 and lists readiness work, but its `Architecture principle` paragraph still says:

> Expensive DSP remains behind explicit rendering so visual editing stays responsive.

That sentence reflects the older model and is now incomplete/outdated.

It should be rewritten to match the 0.13 contract:

- edits project immediately
- cheap playback changes remain immediate
- expensive edits can generate automatic disposable FAST previews
- explicit render guarantees selected final quality
- export forces final-current audio

This handoff documents the intended truth; the README should be corrected early in the next documentation pass.

## B. `js/app.js` contains legacy wording and handlers

The project grew by layering richer modules on top of the original app shell.

Examples of legacy text in `app.js` still include phrases such as:

- `POSITION PENDING · RENDER TO COMMIT`
- `WARP RESET · RENDER TO APPLY`

Those phrases can be misleading under the automatic-preview architecture even if newer handlers/state surfaces override the user-visible workflow.

Before deleting old handlers, determine actual load/event ownership. The right cleanup is to reduce duplicate authority carefully, not perform a broad rewrite.

## C. Core ruler math still has historical 4/4 assumptions in older code paths

`app.js` includes some older bar math built around `beat * 4`. Richer meter-aware modules already handle current meter behavior in important workflows. If touching ruler/grid internals, audit for remaining hard-coded four-beat assumptions instead of assuming every path is meter-aware.

## D. No actual separator service is provisioned yet

Browser/client contract is ready; infrastructure is not.

This is one of the largest concrete remaining 1.0 dependencies.

## E. Real-music/device QA still matters

Synthetic tests and Chromium automation are strong regression protection but cannot prove subjective time-stretch quality or every hardware/browser behavior.

Representative listening tests remain necessary.

---

# 30. Settled decisions — do not re-litigate without evidence

The following choices are intentional and should be preserved unless real QA gives a reason to change them:

1. **Source audio remains immutable.**
2. **Project/edit data is the authority.**
3. **Manual musical correction is first-class.**
4. **Grid correction and warp are separate concepts.**
5. **Visual/UI projection remains immediate.**
6. **Automatic previews are disposable derived caches.**
7. **Automatic preview currently uses FAST quality after ~700 ms settle.**
8. **Explicit render remains the selected final-quality operation.**
9. **Export guarantees final-current audio first.**
10. **Existing valid higher-quality audio should be reused instead of automatically downgraded.**
11. **Heavy external processing is optional, not part of critical boot.**
12. **Stems use Vocals / Drums / Bass / Other.**
13. **GitHub Pages is the production hosting path.**
14. **Recovery remains independent of the workstation module graph.**
15. **Normal project saves do not embed source audio bytes.**
16. **The service-worker alpha strategy stays update-friendly/network-first.**
17. **Compact UI containment is a tested requirement.**
18. **The custom granular engine should be judged with real listening tests before replacing it.**

---

# 31. Recommended real-audio QA matrix

The next meaningful manual QA should use representative real tracks, not only the procedural demo.

Priority scenarios:

## Preview scheduling

- make a small warp edit and stop dragging
- confirm preview starts after settle without pressing Render
- confirm the edit is audible when preview reaches current
- make several rapid warp edits before 700 ms expires
- confirm only the newest revision wins
- edit again while a preview worker is already running
- confirm old preview is cancelled/superseded cleanly
- press Play before preview is ready
- confirm playback remains usable and UI accurately says preview is catching up/using previous audio
- press Play after preview is current
- confirm PREVIEW indication

## History

- warp → preview current → Undo
- confirm preview state updates correctly
- Redo
- mix-only gain/trim/fade Undo/Redo
- confirm a valid timing preview is not destroyed unnecessarily

## Quality/final render

- generate FAST auto preview
- select BALANCED final
- confirm preview stays usable
- Render Final
- confirm AUDIO CURRENT
- repeat with HIGH
- cancel final render and confirm the prior usable preview remains available

## Export

- leave final pending while preview is current
- export WAV
- confirm Phase runs the selected final-quality path before export
- test full mix and loop/region export

## Memory

- load long/high-sample-rate material
- create stems if available
- observe DIAG resident memory
- confirm caution pauses automatic preview rather than crashing browser

## Musical correctness

- incorrect detected BPM → ½ / ×2 correction
- incorrect downbeat → Shift+Click Bar 1 correction
- manual grid correction should not create unintended time stretch
- manually chosen A/B alignment points
- 3/4 and 6/8 source behavior
- relative-key Match Assist

## Device/browser

At minimum test:

- current desktop Chromium/Edge
- Chrome desktop
- installed PWA mode
- one lower-memory Windows machine if available
- mobile only as a containment/launch check unless mobile editing is explicitly being productized

Capture DIAG/support snapshots when behavior is questionable rather than relying only on screenshots.

---

# 32. Recommended next build order

## Priority 1 — documentation/authority cleanup

Small, low-risk pass:

- update stale README explicit-render-only sentence
- audit/replace misleading legacy user-visible `app.js` render wording
- avoid changing functionality during this pass

## Priority 2 — real-audio Phase 0.13 validation

Use several actual songs with different tempo/meter/production characteristics.

Focus on:

- preview scheduling races
- preview quality acceptability
- render cancellation
- Undo/Redo
- playback while preview catches up
- export forcing final
- long-session memory behavior

Use DIAG evidence to decide tuning instead of guessing.

## Priority 3 — NXCore/local stem separator

Do not redesign the front-end contract.

Implement/provision the server side for:

```text
POST /v1/stem-jobs
GET  /v1/stem-jobs/:id
GET  stem result URLs
```

Desired worker properties:

- local/AeroVista controlled
- queued jobs
- progress
- cancellation where practical
- temporary artifact cleanup
- safe source upload limits
- four canonical outputs
- no requirement that the worker be reachable for core Phase launch

After provisioning, add an integration smoke against the service from a controlled environment.

## Priority 4 — audio quality profiling

Only after real tracks are being used:

- compare FAST preview vs BALANCED/HIGH
- identify transients/vocals/bass where granular artifacts are objectionable
- tune grain/overlap/boundary parameters
- decide whether a mature external DSP engine is actually needed

## Priority 5 — release candidate polish

- startup/signature sound
- visual hierarchy cleanup based on real use
- accessibility recheck after any UI additions
- branch protection/release governance
- final recovery path drill
- clean issue list
- version/release naming

---

# 33. Suggested 1.0 exit criteria

Phase should not be called 1.0 merely because the feature list is long.

A reasonable 1.0 exit requires:

- clean boot on representative desktop browsers
- automated Chromium suite green
- full unit/model/static suite green
- Pages deployment green
- offline relaunch proven
- session restore/relink safe
- no known data-loss path in project metadata
- real-audio preview/final scheduling stable under rapid editing
- final WAV export verified on real projects
- subjective audio quality acceptable for intended first release
- resource preflight behaving sensibly on lower-memory hardware
- actual separator either deployed and reliable or explicitly scoped as optional/post-1.0
- recovery route usable after simulated stale/broken PWA state
- documentation consistent with actual preview/final architecture
- no misleading duplicate user-visible workflow paths

---

# 34. What not to do next

Avoid these failure modes:

- do not return to an explicit-render-after-every-edit UX
- do not overwrite source audio
- do not make automatic analysis authoritative
- do not silently render HIGH quality on every mouse movement
- do not let automatic preview block UI interaction
- do not treat preview cache as permanent project data
- do not embed large audio blobs into localStorage/project JSON
- do not redesign the stem client while the missing piece is the server
- do not move optional heavy modules into critical startup
- do not rewrite the entire original app shell just to remove technical debt
- do not claim studio-grade DSP quality without listening evidence
- do not call Pages success a manual production-browser test

---

# 35. Concise technical continuation checklist

When the next session opens:

1. Confirm current `main` head.
2. Read this handoff and current README.
3. Check latest Phase checks / browser smoke / Pages runs.
4. Confirm visible version and service-worker cache generation.
5. If current code still matches this state, correct README preview/final wording.
6. Audit legacy `app.js` user-facing render language without breaking modern handler ownership.
7. Run or expand real-audio QA around automatic preview races.
8. Use diagnostics/performance evidence for tuning.
9. Then provision the real NXCore/local `4stem` separator against the existing provider contract.
10. Keep startup/signature sound and release polish for the final stabilization phase.

---

# 36. Final architectural statement

This is the principle that should survive into Phase 1.0:

> **Analysis proposes. The user corrects. Source audio stays immutable. The edit map is authoritative. Visual and cheap mix changes respond immediately. Expensive transformations can build cancellable disposable previews in the background. Explicit rendering guarantees the selected final quality, and export never bypasses that guarantee.**

That model preserves the safety of the original Phase architecture while giving the workstation the responsive feel expected from a real DAW-style tool.
