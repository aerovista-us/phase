# EchoVerse Phase

**Phase** is the EchoVerse Audio workstation for arranging, warping, synchronizing, remixing, and rendering audio locally.

## Current foundation

Phase starts from the functional CUTS browser editor and is being refactored into a calmer, local-first audio workstation. Existing transport, multitrack timeline, import, playback, editing, mixer, project state, and WAV export are retained while the new warp architecture is introduced nondestructively.

## Product direction

- PWA / installable desktop-like experience
- Local-first audio and project handling
- Beat + downbeat detection with visible tick marks
- Editable beat/downbeat grid
- Lockable warp anchors
- Piecewise timing warp: drag a later marker and proportionally stretch only the region after the previous locked anchor
- Pitch-preserving timing by default; varispeed as an optional mode
- Visual edits separated from audio DSP for responsive interaction
- Explicit **Render Changes** step, similar to manual calculation in a spreadsheet
- Dirty-region rendering and cached playback
- Mashup tools: align downbeats, match tempo, key assistance, and later stem separation
- Optional heavy DSP worker on AeroVista/NXCore; Vercel hosts the application shell

## Architecture principle

The original audio remains immutable. Phase stores edit intent as project data (beat grid, warp anchors, pitch, fades, etc.). The UI immediately projects those edits visually. High-quality audio processing occurs only when the user explicitly renders changes.

## Initial milestones

1. **UI / PWA shell** — EchoVerse Phase branding, calmer workstation UI, install/offline shell.
2. **Warp model** — beat/downbeat overlays, anchor state, drag interactions, dirty-region tracking.
3. **Analysis** — BPM, beats, downbeats, meter/confidence, manual correction.
4. **Renderer** — pitch-preserving piecewise time stretch, cached region renders.
5. **Mashup workflow** — sync downbeats, match tempo/key, stems and export.

## Startup signature

A short original EchoVerse Phase startup/demo sound will eventually auto-load as the first demo asset, in the spirit of memorable classic audio-software demo clips while remaining entirely original to Phase.
