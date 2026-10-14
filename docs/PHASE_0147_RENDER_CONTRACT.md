# Phase 0.14.7 S1a — Sample-frame master render contract
**Status:** experimental engine contract on PR branch; this is **not** an enabled streaming WAV export.

## Baseline

The known-good production application remains Phase 0.14.6 at `b2f59cb` (with a later docs-only merge at `8bbc502`). Latest GitHub Pages deployed successfully. NXCore is offline and this session's tools cannot resolve the public domain for an independent live-browser assertion. Edge user-profile recovery, physical touch, and human listening remain tracked in [#9](https://github.com/aerovista-us/phase/issues/9).

## S1a invariants
- Output is indexed by **integer frames** in one fixed output sample rate. Every chunk has [startFrame,endFrame) and no overlap, gap or duplicate frame. The final chunk can be shorter.
- The output's total length uses the historical one-pass rule: `ceil(masterDurationSeconds × outputSampleRate)`.
- A whole-arrangement **normalizationCount** is computed once from all gain groups. Neither silence nor a changing number of active clips is allowed to recalculate the divisor per chunk.
- The master output gain stays at **0.92** while this reference contract is validated. Fades retain original absolute project time. Original WAV/MP3 files remain the only source of render-quality PCM.
- Every chunk's offline render is explicitly requested with an integer `frameCount` so floating-point seconds do not introduce a trailing frame.
- A classic RIFF WAV render is rejected before production if the PCM data exceeds `0xFFFFFFFF - 36` bytes, since RF64 headers/writers do not yet exist.
- A chunk can be silence: this must still generate its full exact output frame count. A short or empty original mix must fail safely.

## Modules
- `js/master-render-plan.js`: pure immutable render plan, global normalization, integer chunk generator and coverage validation.
- `js/export.js`: compatible optional `normalizationCount` in `renderMixRegion()` plus `renderPlannedMasterChunk()` for short isolated comparisons.
- Tests include Node boundary/invalid-geometry/RIFF limits and Chromium whole-reference vs chunked mixing (multiple gains/groups, native/mixed source rates, equal-power fades, silent interval, multiple chunk widths).

## What S1a does NOT solve
- No production UI switch, streaming file sink or long-memory writer.
- Does not avoid full render buffers unless S1b drives one bounded section at a time and discards each before the next.
- Repeated decoder startup at chunk boundaries, especially with different source sample rates, may produce minute resampler discrepancies. Browser reference tests must report this; do not claim sample-perfect musical joins unless the test evidence supports it.
- For MP3, bounded PCM output does not mean compressed random seeking; earlier frames may still be decoded.
- This does not fulfill the real device/normal Edge profile/listening gates in #9.

## S1b construction gate
Only after tests prove acceptable chunk boundaries: implement a writable file stream with progress/cancel, exact little-endian RIFF header and finalization, safe permissions/failure cleanup, and explicit short-file fallback where browsers lack File System Access. Benchmark memory for 2/10/30-minute recordings, and test actual mixed-rate, gapless MP3, silence, overlapping clips, and crossfades. No automatic merge or live promotion from this document alone.

## Audit evidence
- Production Actions and project roadmap: [Phase advancement plan](PHASE_ADVANCEMENT_PLAN_2026-10-14.md).
- Current release handoff: [0.14.6](HANDOFF_2026-10-14_PHASE_0146.md).
- Open external field-acceptance gate: [#9](https://github.com/aerovista-us/phase/issues/9).
- Streamed master output milestone: [#10](https://github.com/aerovista-us/phase/issues/10).
