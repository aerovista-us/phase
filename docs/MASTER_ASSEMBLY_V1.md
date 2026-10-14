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

## Splice Precision v0.14.1 candidate (not yet deployed)
- Optional **Snap Out** searches only ±12 ms of the original decoded PCM for a low-amplitude sign crossing. It changes the outgoing source end and ripples downstream clip positions by the same small time difference. Snap is never automatic.
- Optional **Snap In** looks for a similar crossing in the next source and *slips* its source IN and OUT together, preserving master timing and clip duration. It is unavailable without spare source head/tail.
- **Crossfade Join** requires adjacent clips within 5 ms, permits 5–250 ms only if shorter than 45% of both clips, shortens the total master by overlapping the next clip and rippling later clips, and applies equal-power sin/cos gain curves. Explicit Undo restores the original edit map.
- Equal-power crossfades are suitable for unrelated material but may increase summed peak level on phase-correlated sounds; export still has no master limiter. Live and offline paths share the same gain automation helper.
- Original audio is never overwritten. Waveform indexing is unchanged and still temporarily decodes an entire file; true partial decoding remains a separate milestone.
- Test gate: full npm check and Node regression suite, portable Chromium source/snap/crossfade/WAV smoke, browser visual QA and no regressions in Mix & Sync before merge.

## 0.14.2 streamed waveform indexing candidate (not published)

- **PCM WAV:** Reads original file by bounded `Blob.slice()` segments. Supports RIFF PCM 8/16/24/32-bit and float 32/64-bit, up to 8 channels. Waveform buckets track **min and max across every source channel**. Retains a multiresolution index, not decoded audio.
- **MP3:** Attempts native `WebCodecs AudioDecoder` from parsed MPEG Layer III frames, in bounded chunks. Produces min/max peak indices and releases decoded audio frames immediately. Supported browsers benefit; incompatible codecs/browser contexts use a clearly marked full-decode compatibility path.
- **Other containers:** Existing `decodeAudioData()` compatibility path remains. It is not advertised as lightweight; files exceeding the conservative fallback budget are rejected with guidance.
- Existing source solo uses media-element playback. Only master playback/export and native PCM splice inspection decode complete original audio on demand. All masters render from original source files, never waveform summaries or low-resolution proxies.
- Waveform peak indices are limited to approximately 2 million 128-frame buckets (16 MiB base min/max arrays); compressed audio and other metadata require additional bounded overhead. Indexed source time may differ slightly from other MP3 decoders due to encoder padding/priming; check this using real-source browser fixtures.
- **Not yet implemented:** partial original-quality master rendering/clip decoding, progressive waveform paints, or a browser codec path for FLAC/AAC/OGG. These remain separate performance gates.
- Tests must verify exact waveform min/max preservation against decoded PCM, maximum file-slice size, complete-source coverage, normal browsing and MP3 compatibility/fallback, final original-quality WAV output, existing Mix & Sync regression and recovery service worker.

## 0.14.3 — Bounded original PCM clip decode (candidate)

**Authority:** waveform peaks and original PCM decode are separate. This milestone reduces *source decode* memory for supported PCM WAV files in Master Assembly master audition and WAV export; it does not change source file bytes or sample-rate authority. The renderer and gain-envelope contracts remain the same.

- Clip preparation reads the exact sample-aligned `sourceIn .. sourceOut` window of a local original PCM WAV via `File.slice()`. Playback can narrow it further to the audible range after the playhead or for a join preview.
- The reader supports the same validated RIFF PCM and IEEE float encodings as streamed waveform indexing (with a strict per-window 96 MiB decoded PCM budget). Reads remain bounded; native `AudioBuffer` is built only for selected source samples.
- All clip windows retain native sample rate. Offline rendering uses the existing `renderMix` and Web Audio sample-rate conversion as necessary. Clip positions and fade curves are re-based to the segment's project position.
- MP3, OGG, AAC, FLAC and unsupported WAV layouts continue to use the existing whole-source compatibility decode. These are **not** described as partial decoding. All sources are subject to an aggregate memory preflight.
- Large full-length clips that exceed the per-window budget require splitting into shorter regions. The output offline mix and uncompressed WAV allocation are also still whole-arrangement allocations. Streaming final WAV output is *not* part of this milestone.
- Normal solo uses the existing native media element. Sample-level Splice Inspector currently keeps its separate full-source native decode and memory guard; this milestone does not alter it.
- No remote upload, catalog mutation, client-permission change, or edits to Mix & Sync.

**Release acceptance:** Pure Node tests of exact sample alignment, bounded reads, re-based fades, seek windows, unavailable-source and memory limit behavior; Chromium import/play/PCM WAV export of a late region without original full-file reading; existing Mix & Sync regressions. Additional listening quality review is separate.

## 0.14.4 — Experimental MP3 window decoding (NOT deployed)

The new `assembly-mp3-window.js` prototype scans MP3 compressed frames **sequentially from the beginning**, processes them through browser WebCodecs and keeps only the requested original-quality PCM interval in an `AudioBuffer`. This avoids retaining full-song decoded PCM but **is not random access**: late sections still require parsing/decoding earlier compressed audio. It enforces a decoded-output memory limit, compressed scan limit, bounded Blob reads and a bounded decoder queue via periodic flush.

**Critical authority gate:** MP3 encoder delay, gapless padding and native browser decoder behavior can shift the musical timeline. The experiment compares short and late windows from CBR/VBR fixtures against the browser's authoritative `decodeAudioData` output and records the best sample offset and correlation. This module is **not wired into production master playback or export** until sample alignment can be established and an explicit safe fallback is supported.

No waveform proxy enters rendering, source files are immutable, and Phase 0.14.3 Mix & Sync, WAV windows and existing MP3 master export behavior are unchanged.
