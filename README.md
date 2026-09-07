# EchoVerse Phase

**Phase** is the EchoVerse Audio workstation for arranging, warping, synchronizing, remixing, and rendering audio locally.

Live alpha: **https://phase.aerovista.us/**

## Current foundation — Phase 0.10.3

Phase is now a functional local-first mashup workstation rather than only a CUTS-derived prototype shell.

Implemented today:

- installable PWA deployed from GitHub Pages
- local audio import and Web Audio playback
- shared multitrack timeline with zoom and seekable playhead
- BPM, beat, downbeat and key analysis with confidence indicators
- 3/4, 4/4 and 6/8 meter analysis with project-wide meter-aware bars, phrases, regions and loops
- manual grid correction and editable Bar 1/downbeat phase
- ½ BPM / ×2 BPM tempo-octave correction without discarding the detected grid
- lockable warp anchors and piecewise timing edits
- separate pitch control and pitch-preserving background render worker
- explicit **Render Changes** workflow; source audio remains immutable
- chosen A/B alignment points and grid-following alignment
- beat/bar/8/16/32-bar phrase snapping and whole-track MOVE
- advisory phrase-boundary suggestions with previous/next phrase navigation
- Match Assist compatibility scoring across key, tempo and meter
- advisory phrase-pair suggestions that set ALIGN points without moving audio automatically
- track MUTE / SOLO / LEVEL controls
- alignment audition, project loops and loop WAV export
- full mix WAV export
- project save/load, local session restore and metadata Undo / Redo
- nondestructive per-track IN / OUT trims
- reusable arrangement REGION selection with snap/free drag and Region → Loop
- region-driven per-track fade in / fade out
- A → B crossfade across a selected REGION
- fades honored by playback, audition and WAV export without requiring DSP render
- hybrid render path that preserves original PCM outside dirty warp regions
- sparse dirty-region granular DSP, render quality modes, cancellation, work stats and render reuse
- responsive workstation containment and PWA update handling

## Architecture principle

The original audio remains immutable. Phase stores edit intent as project data: beat grid, warp anchors, pitch, placement, alignment points, trims, regions, fades and mix metadata. The interface projects those edits immediately. Expensive DSP is isolated behind explicit rendering so visual editing stays responsive.

```text
SOURCE AUDIO
   |
   +--> ANALYSIS --> PROJECT / EDIT MODEL --> LIVE VISUAL PROJECTION
   |                                      |
   |                                      +--> RENDER CHANGES
   |                                             |
   +---------------------------------------------+--> LAST RENDER / PLAYBACK / EXPORT
```

Phase itself stays browser-local and PWA-friendly. GitHub Pages hosts the static application shell at `phase.aerovista.us`. Optional AeroVista/NXCore workers remain a later path for heavyweight jobs such as stem separation or higher-cost DSP; they are not required for the core editor.

## Build roadmap

### 0.8 — Arrangement editing — complete alpha milestone

- IN / OUT trim
- arrangement REGION selection
- trim/region project persistence
- trim-aware playback and export
- region-driven audition loop
- region-driven fades
- A → B crossfade
- fade-aware playback and export

### 0.9 — Render quality — complete alpha milestone

- original PCM retained outside changed warp regions
- dirty-region granular DSP rather than whole-track processing
- render-boundary crossfades
- FAST / BALANCED / HIGH quality modes
- render cancellation and work statistics
- rendered-audio reuse for placement-only edits
- timing/pitch/render regression tests

### 0.10 — Mashup intelligence — complete alpha milestone

- stronger downbeat confidence and manual correction
- half/double-tempo resolution
- 3/4, 4/4 and 6/8 meter handling
- meter-aware bar/phrase/region/loop behavior
- phrase-boundary suggestions
- harmonic/tempo/meter compatibility guidance
- advisory A/B phrase-pair suggestions
- all automatic decisions remain editable and non-destructive

### 0.11 — Stems — active next milestone

- stem-aware project model
- manual stem import as an immediately useful local workflow
- vocal/instrumental or multi-stem separation provider interface
- optional local/NXCore heavy worker path
- stem-aware playback, rendering and export

### 0.12 → 1.0 — Productization

- robust project bundle / audio relinking flow
- keyboard map and contextual help
- diagnostics and recovery tooling
- deeper accessibility and responsive QA
- performance profiling
- startup/demo project
- original EchoVerse Phase signature sound

## Startup signature

A short original EchoVerse Phase startup/demo sound will eventually auto-load as the first demo asset, inspired by the memorable feel of classic audio-software demo clips while remaining entirely original to Phase.
