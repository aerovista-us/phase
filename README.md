# EchoVerse Phase

**Phase** is the EchoVerse Audio workstation for arranging, warping, synchronizing, remixing, stem-routing and rendering audio locally.

Live alpha: **https://phase.aerovista.us/**

## Current foundation — Phase 0.12.8

Phase is now a functional local-first mashup workstation with recovery, diagnostics, staged startup, lightweight project packaging, lifecycle-safe session persistence, resource preflight and an original first-run demo.

Implemented today:

- installable PWA deployed from GitHub Pages at `phase.aerovista.us`
- local audio import and Web Audio playback
- shared multitrack timeline with zoom and seekable playhead
- BPM, beat, downbeat and key analysis with confidence indicators
- 3/4, 4/4 and 6/8 meter analysis with meter-aware bars, phrases, regions and loops
- manual grid correction and editable Bar 1/downbeat phase
- ½ BPM / ×2 BPM tempo-octave correction without discarding the detected grid
- lockable warp anchors and piecewise timing edits
- separate pitch control and pitch-preserving background render worker
- explicit **Render Changes** workflow; source audio remains immutable
- chosen A/B alignment points and grid-following alignment
- beat/bar/8/16/32-bar phrase snapping and whole-track MOVE
- advisory phrase-boundary suggestions with previous/next navigation
- Match Assist compatibility scoring across key, tempo and meter
- advisory A/B phrase-pair suggestions that set ALIGN points without moving audio automatically
- track MUTE / SOLO / LEVEL controls
- alignment audition, project loops and loop WAV export
- full mix WAV export
- nondestructive IN / OUT trims, REGION selection, fades and A → B crossfades
- hybrid render path that preserves original PCM outside dirty warp regions
- sparse dirty-region granular DSP, quality modes, cancellation, work stats and render reuse
- project save/load, local session restore, metadata Undo / Redo and one-pass source relinking
- periodic autosave plus lifecycle persistence on page hide, freeze and close transitions
- source/stem identity using filename plus lightweight size/type/modified metadata
- **SAVE PACKAGE** project files with explicit source/stem asset manifests while keeping audio bytes external
- project schema compatibility guard: legacy maps remain readable while unsupported future schemas are refused safely
- canonical Vocals / Drums / Bass / Other stem slots per track
- manual stem loading plus optional HTTP/NXCore separation-provider contract
- stem-aware playback, rendering, loops, export, per-stem LEVEL / MUTE / SOLO and project persistence
- built-in diagnostics for runtime, PWA/storage, grid/render state, decoded-audio memory and browser capability
- local persistence diagnostics showing writable state, saved-map size/schema/timestamp and warnings when a loaded project is not safely persisted
- launch/runtime error ring buffer plus standalone `recovery.html` that does not load workstation modules
- recovery route runtime-history display plus metadata-only recovery report download
- support snapshot and redacted support snapshot export without audio bytes
- non-destructive app-cache reset and render-cache recovery controls
- contextual Quick Start help and complete keyboard map
- keyboard-focusable musical markers, live status announcements, semantic controls, reduced-motion and high-contrast handling
- staged startup: core editor first, secondary DEMO/STEMS/DIAG/HELP UI after first paint/idle
- local boot timing telemetry in DIAG
- deployed `build.json` identity containing version, commit and build time, with stale-app detection
- render/separation memory preflight using decoded-audio and temporary-working-memory estimates; normal sessions remain silent while unusually large jobs ask before continuing
- test-gated GitHub Pages deployment: syntax and the full suite run in the deployment workflow before the artifact can publish
- static-shell CI checks that verify Pages artifact coverage, the complete offline JavaScript module graph, relative imports, version consistency, lifecycle/runtime guard ordering and deploy-gate retention
- original procedural two-track **DEMO** generated locally and loaded through Phase's real file/decode path
- responsive workstation containment and network-first alpha PWA update handling

## Architecture principle

Original audio remains immutable. Phase stores edit intent as project data: beat grid, warp anchors, pitch, placement, alignment points, trims, regions, fades, mix metadata and stem-routing state. The interface projects those edits immediately. Expensive DSP remains behind explicit rendering so visual editing stays responsive.

```text
SOURCE AUDIO
   |
   +--> ANALYSIS --> PROJECT / EDIT MODEL --> LIVE VISUAL PROJECTION
   |                                      |
   |                                      +--> RENDER CHANGES
   |                                             |
   +---------------------------------------------+--> LAST RENDER / PLAYBACK / EXPORT
   |
   +--> OPTIONAL STEM PROVIDER --> VOCALS / DRUMS / BASS / OTHER
                                     |
                                     +--> SAME TRACK EDIT / RENDER MODEL
```

Phase itself stays browser-local and PWA-friendly. GitHub Pages hosts only the static application shell. Optional AeroVista/NXCore workers are used only when heavyweight processing such as source separation is explicitly requested.

## Build roadmap

### 0.8 — Arrangement editing — complete alpha milestone

- IN / OUT trim
- REGION selection and Region → Loop
- fades and A → B crossfade
- trim/fade-aware playback and WAV export

### 0.9 — Render quality — complete alpha milestone

- original PCM retained outside changed warp regions
- dirty-region granular DSP rather than whole-track processing
- render-boundary crossfades
- FAST / BALANCED / HIGH quality modes
- render cancellation, work statistics and reuse
- timing/pitch/render regression tests

### 0.10 — Mashup intelligence — complete alpha milestone

- stronger downbeat confidence and manual correction
- half/double-tempo resolution
- 3/4, 4/4 and 6/8 meter handling
- phrase-boundary suggestions
- harmonic/tempo/meter compatibility guidance
- advisory A/B phrase-pair suggestions
- all automatic decisions editable and non-destructive

### 0.11 — Stems — substantially complete client milestone

- stem-aware project model
- manual local Vocals / Drums / Bass / Other import
- per-stem LEVEL / MUTE / SOLO
- stem-aware playback, rendering and export
- one-pass stem relinking
- optional separation-provider client with progress/cancel
- documented provider contract for local/NXCore implementation
- remaining external dependency: choose/provision the actual separation service endpoint

### 0.12 — Productization — substantially complete alpha milestone

Completed:

- diagnostics and recovery tooling
- standalone recovery route and metadata-only recovery report
- launch/runtime error history
- PWA/cache recovery without intentionally deleting the saved project map
- one-pass source/stem relinking with lightweight identity checks
- SAVE PACKAGE asset-manifest workflow
- project schema compatibility guard
- support snapshot / redacted support snapshot workflow
- periodic + page lifecycle session persistence
- local persistence health diagnostics
- keyboard map and contextual help
- accessibility/focus pass
- decoded-audio memory diagnostics and device-aware caution thresholds
- render/stem-separation resource preflight
- staged optional UI loading and boot timing telemetry
- deployed build identity/stale-app detection
- test-gated Pages deployment plus static-shell/offline module integrity tests
- original procedural first-run DEMO

Remaining before 1.0:

- performance profiling using real DIAG timing/memory evidence
- deeper real-browser interaction QA
- original EchoVerse Phase startup/signature sound
- actual local/NXCore separation service provisioning
- final release-readiness QA and issue cleanup

## Startup signature

A short original EchoVerse Phase startup/signature sound is still planned. The current DEMO audio is entirely original and procedural, but it is a learning session rather than the final branded signature clip.
