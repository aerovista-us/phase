# Phase Master Assembly — v0.14.0 candidate

## Scope and user workflow

Keep the existing Mix & Sync workstation unchanged at `index.html`. New `assembly.html` opens Master Assembly, a local-first nondestructive editor focused on assembling a single output from segments of many sources.

1. Import files through Add Sources, or drop them on the page. Each file is temporarily decoded to construct multi-resolution **min/max** waveform indices, then only the original File and compact peaks remain.
2. Preview each source alone using browser media playback. Click a waveform to set IN; Shift-click for OUT, or use the numeric fields (up to six decimals; quantized to source sample rate).
3. Append selected audio or Insert at Playhead. Insert inside a clip splits it and ripples later clips. Drag clips on the master to move, select to edit fade/start, set the playhead to split, or copy/paste/delete/undo.
4. The master auto-fits to the current arrangement by default; use manual Zoom or Fit Master to return to overview. Zoom and examine full master waveforms. The splice inspector draws min/max peaks near the cut; **Load Sample Detail** explicitly decodes source PCM for 10/50/200ms views, resolving native samples when zoom permits.
5. Play master from playhead. Export WAV through existing `renderMix` and `downloadWav` using the full original decoded audio. No lossy preview audio enters the master export. Output is 16-bit uncompressed stereo PCM.
6. Save a lightweight assembly project map. After opening a map, relink the original files by matching filename + byte length.

## Authority and rendering contracts

- Original source files remain immutable. Each clip carries `sourceId`, source IN/OUT, `sourceRate`, master start, fades and gain.
- Assembly project schema v1 is distinct from Phase's existing Mix & Sync project schema v12; existing projects remain unaffected.
- Crossfades are supported by clip overlap + per-clip fade controls. The program makes **no** claim of automatic zero-crossing correction or mastering-grade limiting.
- Compact waveforms are accurate min/max summary visualizations, **not** PCM available for editing or export. Full-resolution sampling is only available after explicit on-demand decode.
- Browser `decodeAudioData` still decodes whole files **transiently** to build peaks. This is not true partial decoding; future work may use server-generated peaks, WebCodecs or bounded stream decoding where supported.
- Audio sources never leave the browser through this page, and are never embedded in saved map JSON.
- Separate mode/browser route makes backward compatibility and rollback simple.

## Validation performed

- `npm run check`: passed in NXCore isolated Git checkout.
- `npm test`: 146/146 passed (existing regressions + assembly model and peak preservation tests).
- Headless Chromium functional smoke using two generated WAV sources: index, two source decks, append, insertion inside occupied clip (split/ripple), copy/paste, on-demand sample detail, master playback/stop, actual WAV export/download. Output probed 44.1kHz stereo PCM, duration 10.50 seconds. Zero runtime page errors.
- Existing browser smoke now targets 0.14.0; new CI Playwright test covers the assembly flow. CI/visual and mobile gate **not** yet independently verified at GitHub exact PR head.

## Open release gates

- Github CI Playwright and static tests on exact PR head.
- Visual QA at desktop/tablet/mobile, keyboard and assistive technology review, long source/codec tests and performance memory profiling.
- More efficient true partial decoding/precomputed peak files for very large source tracks.
- Test section export, save/relink recovery with similarly named files, multichannel audio, clip intersection edge cases, sample cursor ergonomics and click mitigation.
- Store security/identity is separate App Adapter future work. Do not add remote uploads without approved capability contract.

## Deployment

GitHub Pages is triggered only on merge to `main`. Deploy artifact now includes assembly.html and assembly.css; SW cache bumps to v44 and adds the three assembly JS modules. No runtime service, private source catalog or AVCC registry changes.
