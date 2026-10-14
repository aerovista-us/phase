# EchoVerse Phase — Project Audit and Advancement Plan
**Date:** October 14, 2026, Pacific
**Repository:** https://github.com/aerovista-us/phase
**Workspaces:** https://phase.aerovista.us/ (Mix & Sync) and https://phase.aerovista.us/assembly.html (Master Assembly)
**Audited main commit:** b2f59cbbaef19db4b808c919c3426e0c9b0d873f (Phase 0.14.6)
**Document status:** Advancement proposal. An audit/plan is not authorization to mark unimplemented work complete.

## Executive decision

Phase is a working, test-gated music editing **alpha**. The core founder goal is already substantially fulfilled: a large master arrangement above multiple compact source tracks, original min/max waveforms, drag/place/insert/split/copy/paste/undo and splice inspection, original-source fades, and a working full WAV or section WAV export. Separately, Mix & Sync provides beat/grid/warp/pitch/stem workflows.

**Do not restart the editor or combine its two UI modes.** The most valuable sequence is: prove the existing production release with actual users and source music; remove the full-master render-memory ceiling; polish detailed editing and history; add export-quality measurement and musical approval; then connect Phase to EchoVerse_Analyses through a versioned contract.

### Why this order matters
Most new source work was optimized in Phase 0.14.1–0.14.6, but full master export still allocates one complete stereo OfflineAudioContext result and a separate full PCM 16-bit WAV output buffer. At 48 kHz stereo, a 30-minute output is approximately **691 MB of float PCM** and **346 MB of 16-bit WAV data**, before original source windows, additional browser allocations, and Blob. Making long-form export genuinely bounded is the major engineering bottleneck. Starting more UI features or cloud services before this improves appearance without removing that product limitation.

## 1. Evidence inventory / reconstructed goals

### Source goals from the Phase project thread
1. A large master on top, small independent source waveforms below, with clear selection/paste from multiple original recordings.
2. Easily drag and move tracks in both Master Assembly and Mix & Sync. Precise joins, zoom, waveform detail, snapping, fades, reversible edits, and no incorrect audio.
3. Remain responsive and usable without loading every song's complete PCM or rebuilding all waveforms on every pointer move.
4. Local-first source integrity; export original-quality finished WAV; no silent upload or source overwrite.
5. Support Mix & Sync's BPM, grid, warp, pitch, multi-stem, alignment, and project file workflow.
6. Restore existing saved projects, reattach source audio, recover from stale browser caches and keep both workspaces reliable.
7. Connect to broader EchoVerse production/analysis when a clear interchange is defined, rather than merging codebases prematurely.

### Current implementation, Phase 0.14.6
- Master Assembly: source-to-master drag and tap/click-to-place, timeline insertion with split/ripple, compact waveform source decks, master overview/zoom, clip selection/move, preview/cancel, Undo, clip fades, source solo, zero-cross helpers and equal-power crossfades, bounded WAV/MP3 detailed sample inspection, section export and full WAV export.
- Mix & Sync: two-track alignment, timing/tempo/meter/beat grid, warp, pitch, trims/regions, stem slots, gain/mute/solo, preview, rendering, loops, output, separate v12 project persistence.
- Bounded min/max peak indexing uses compressed frames/WAV slices. Supported PCM WAV and MP3 clip decoding uses bounded PCM windows, with clear native fallback; MP3 decoding is still sequential from early compressed frames, not genuine compressed random access.
- Master Assembly map format version 1 is distinct from Mix & Sync project v12. Audio bytes are kept outside maps and require relinking. No automatic shared analysis/session authority is implemented between these editors.
- Service worker generation is **v50**; cache/recovery tools exist.
- The site deployment is GitHub Pages from validated Actions workflows.

### Evidence checked at main SHA b2f59cb
- GitHub Phase checks: https://github.com/aerovista-us/phase/actions/runs/38522706701 — **179/179 Node unit/regression tests passed**.
- GitHub Chromium smoke: https://github.com/aerovista-us/phase/actions/runs/38522706642 — **28 tests passed and 1 private real-recording fixture test skipped** on the hosted runner.
- GitHub Pages publish: https://github.com/aerovista-us/phase/actions/runs/38522710142 — **successful**.
- Current 0.14.6 handoff: https://github.com/aerovista-us/phase/blob/main/docs/HANDOFF_2026-10-14_PHASE_0146.md. It documents three successful one-second original TIMBR recording exports at 48 kHz stereo, sample correlations > 0.9999999, no clipped samples and recorded PCM RMSE around 0.000018–0.000019. This is objective sample evidence, **not** a claim of human listening approval.
- At audit start: no open Phase PRs and no standalone issue backlog. Six action issues were created by this audit.
- Desktop Commander listed NXCore **offline**, last seen roughly 18 hours earlier. No NXCore checkout was synchronized in this audit.
- Direct production-site fetching from this audit session was unavailable, so GitHub Pages success cannot be relabeled an independently completed live-browser test.
- Related private GitHub repositories EchoVerse_Analyses and workspaces exist; their live schema and integration contracts were not audited in depth for this plan.

### Proof hierarchy (keep separate in all reports)
A. Exact-head unit/static CI proves tested contracts.
B. Hosted browser CI proves simulated UI actions and generated audio.
C. Authorized real-file objective tests prove sample counts/correlation/clipping on the tested material.
D. Public-domain test on the user's ordinary browser profile and physical hardware proves real user runtime and storage upgrade behavior.
E. Human listening confirms musical transitions and audible quality. Do not claim E on the basis of A–D.

## 2. Status / gap scorecard

| Goal | Standing | Advancement needed |
| --- | --- | --- |
| Master above compact sources | Built | Navigation at 10–30+ sources, clear selected region |
| Drag source into master, split and ripple | Built in 0.14.6 | Physical-device QA, insertion ghost/snapping |
| Whole-track movement in Mix & Sync | Built | Hardware gestures, deterministic cancel/snap |
| Master move and Undo | Built | Redo, nudge, more explicit overlap behavior |
| Accurate waveform peaks and splice detail | Built | Better zoom navigation and visible seam diagnostics |
| Zero-cross suggestion / fades | Built | True peak/headroom alerts, human listening |
| Bounded original WAV/MP3 clip decode | Built for supported codecs | Stress tests, late MP3 scan time and fallbacks |
| Section WAV export | Built | Golden-sample regression across rates/gaps/overlaps |
| Full master WAV export | Functional but full-buffer | **Incremental writer is top engineering priority** |
| Master + Mix & Sync schema / maps | Separate formats | Safe relink, redo, purposeful interchange |
| Export format and mastering | 16-bit stereo WAV baseline | Quality meters, optional 24-bit/float assessment |
| Standard Edge profile + long-lived PWA | Recovery exists | Reproduce prior private-vs-standard discrepancy |
| EchoVerse Analyses integration | Not wired | Versioned explicit file contract |
| Music/product acceptance | Objective fixtures only | Real complete recordings + listener approval |

## 3. Advancement roadmap and execution order

### S0 — P0: production and user-profile acceptance
**GitHub:** https://github.com/aerovista-us/phase/issues/9 and https://github.com/aerovista-us/phase/issues/14

1. Confirm current public build.json SHA, both editor routes and recovery page, service-worker v50, resource URLs, browser errors, and project-format identity.
2. Back up the standard Edge profile's project map **before** testing recovery; test reload, project restore, relink and normal-tab cache upgrade without clearing local edit data. Compare private mode behavior explicitly.
3. Run keyboard, pointer and actual touch gestures, including source-to-master insert, clip drag cancel, undo, and Mix & Sync snap/Shift free move. Measure edit-response latency and accidental state changes.
4. Reconnect NXCore only when available; inspect branch, clean/dirty working tree and local modifications before syncing the exact main head. Do not overwrite local work.
5. With authorized original TIMBR recordings, verify full arrangements: objective frame count, sample alignment, output peak/clipping, crossfade joins, and **separate human listening comments**.

**Exit:** saved evidence matrix with exact SHA/URLs, browser versions, screenshots, representative recordings, objective samples and the listener verdict. Any unverified line remains open.

### S1 — P1: frame-indexed incremental master mix and WAV writer
**GitHub:** https://github.com/aerovista-us/phase/issues/10
**Working release slot:** Phase 0.14.7 (provisional)

- Design one sample-frame indexed render contract shared with existing section export, fixed project sample rate and channel mapping.
- Keep **one global gain-normalization policy** over all output chunks; never change track normalization just because one chunk has fewer active clips. Preserve the exact original envelope/transition timebase.
- Prototype 2–10 second source-window/render chunks, guaranteeing no missing/duplicated samples at chunk boundaries, no added fade discontinuities and valid silence intervals.
- Implement a streaming writable file sink for supported browsers, finalizing RIFF headers; reject classic WAV >4 GiB until RF64 is explicitly implemented.
- For browsers lacking File System Access, offer a clearly limited fallback with memory preflight rather than claiming buffered Blob output is streaming.
- Add progress, cancellation, failure cleanup, deterministic replay and exact old-vs-new output regression. Test mixed rates, MP3 gapless, 1/221-frame edge cases, multiple source overlaps, long silence and late cuts.

**Exit:** output matches reference for short masters, no new boundary clicks, exact sample count and stable gains, and measured peak memory/time for 2/10/30 minute masters on representative devices. This precedes claims of long-form professional readiness.

### S2 — P1: streamlined editing/drag behavior
**GitHub:** https://github.com/aerovista-us/phase/issues/11
**Working slot:** 0.14.8

- Improve selected clip/source affordances, insertion preview/autoscroll, zoom and source library navigation; preserve legible full-width source waveforms on compact-height decks.
- Add Master Assembly Redo, keyboard fine nudge, deterministic clip overlap/ripple policy and history persistence where appropriate.
- Explicit optional snap hierarchy: source sample, nearby quiet crossing, and tempo/beat/marker where analyzed. Always show snap mode and native-vs-master time.
- Develop an accurate splice seam inspector / click-warning that does not silently shift material. Preview fades and identify correlated-energy rise.
- Prove gesture parity for desktop pointer, trackpad, keyboard and physical touch; test 390/768/1024/desktop widths, 10–30+ decks, focus loss and Esc.

**Exit:** zero unwanted commits on cancel, one-step Undo/Redo map restoration, no offscreen controls, source-selection fidelity across zoom, actionable UI feedback.

### S3 — P1: measured output quality and real musical signoff
**GitHub:** https://github.com/aerovista-us/phase/issues/12
**Working slot:** 0.14.9

- Add precise output reports for sample peak, true-peak estimate, RMS and LUFS with explicit measurement methods and limitations.
- Warn on clipping and correlated crossfade headroom; retain transparent/no-auto-master default.
- Evaluate optional 24-bit PCM, 32-bit float, sample-rate settings and conditional dither; never advertise a mastering limiter until one is implemented and validated.
- Run multi-clip real-music golden outputs and a separate human listen/revision cycle. Keep exported-file provenance.

**Exit:** reproducible WAV results and levels, no unexplained clips, two end-to-end arrangements accepted by the musician/founder.

### S4 — P2: EchoVerse production linkage without coupling codebases
**GitHub:** https://github.com/aerovista-us/phase/issues/13
**Working slot:** 0.15.0 (provisional)

- Inspect current heads/contracts of EchoVerse_Analyses and workspaces before choosing the interface.
- Define a versioned file/JSON interchange: source identity, native sample spans, sample rate, approved edit intent, beat/key/meter with confidence, waveform/analysis evidence provenance, and final master map.
- Prototype Analyze Selected Clip → review advice → explicitly accept edit → return to Phase → render. Keep suggestions advisory and source audio local unless an explicit provider/permission is selected.
- Leave Mix & Sync and Master Assembly independently deployable. App Adapter, identity and billing remain separate decisions.

**Exit:** version guarded two-way proof with one real recording and one assembly, safe relinking, no unapproved upload.

### S5 — P2: productization and 1.0 readiness
**GitHub:** https://github.com/aerovista-us/phase/issues/14 plus defects from prior sprints.

- Seed stale-cache/session transition tests against normal Edge and native device behaviors; avoid automatic site-data deletion.
- Profile multi-hour sessions, decoder memory, source indexing, timing of gesture-to-paint, offline mode, crash/cancel and rehydrate behavior.
- Make provider readiness explicit: the HTTP stem separation contract exists but an actual working service remains a separate infrastructure prerequisite.
- Choose a single authoritative release-status note for SHA, Pages run, PWA cache, supported codecs, residual defects, rollback and quality sign-offs.
- Do not apply 1.0 labeling until representative songs complete both workflows, exported audio and lost-state recovery are accepted, and the high-severity backlog is empty.

## 4. Practical sprint sequence

| Step | Change package | Hard dependency | Test/result gate |
| --- | --- | --- | --- |
| S0 | Field test/recovery + safe NXCore sync | Current 0.14.6 baseline | Public browser/user profile + real audio evidence |
| S1a | Frame-based chunk render contract + golden reference suite | Baseline | Reproducible PCM across arbitrary chunk sizes |
| S1b | Streaming output writer + cancel | S1a | 2/10/30 minute memory and fidelity results |
| S2 | UX, drag, redo, snap/navigation | S0 device findings | Desktop/phone/keyboard test and Undo/Redo |
| S3 | Metering/export formats/quality | S1b | Output standards + musician approval |
| S4 | EchoVerse contract | Up-to-date other repos and user consent | Two-way, no surprise audio upload |
| S5 | Browser/release hardening & 1.0 gate | S1–S4 success | Accepted releases and user recovery |

Parallelize documentation and isolated UI QA, but have **one mainline audio render engine PR at a time**. Do not merge speculative code without exact-head tests or promote solely from a green hosted browser.

## 5. Engineering guardrails

- Original audio bytes and native sample coordinates remain the source of truth. Waveform indices are visualization, never render-quality input.
- The two editors share proven pure audio/time contracts, not duplicated logic or a premature monolithic UI.
- Clip-map edits, project persistence, audio rendering, source relink and network/plugin permissions have distinct authorities. A render or dropped connection must not rewrite originals or erase session data.
- Fix clip mixing gain **globally across chunks**, not active-chunk by active-chunk; validate zero crossings and equal-power fades with original audio.
- Treat compressed formats with unknown delay/padding as guarded full native decode or explicit failure, not guessed “sample exact.”
- Report distinct evidence: code CI, hosted browser, independent public URL, original-audio objective tests, physical device, listening, NXCore sync.
- Deployment requires exact tested commit and Pages proof; release documents should link the evidence and never contain unqualified “everything verified.”

## 6. Owner-ready backlog

**P0:** [#9 Real-device production acceptance](https://github.com/aerovista-us/phase/issues/9), [#14 Recovery and release evidence](https://github.com/aerovista-us/phase/issues/14).

**P1:** [#10 True incremental WAV rendering](https://github.com/aerovista-us/phase/issues/10), [#11 Editing precision](https://github.com/aerovista-us/phase/issues/11), [#12 Export quality and musical approval](https://github.com/aerovista-us/phase/issues/12).

**P2:** [#13 EchoVerse_Analyses/workspaces bridge](https://github.com/aerovista-us/phase/issues/13).

Every issue specifies acceptance conditions; this roadmap links dependencies and release gates.

## 7. Recommended next action

**Start with S0, not another new feature branch.** Reconnect to a usable browser/hardware path, verify 0.14.6 in the original Edge profile, save/reopen a map, import and splice real sources in both workspaces, export and listen, and preserve all evidence. Then open a narrowly scoped S1a render-contract PR tied to #10. Maintain 0.14.6 as the known-good source while iterating.

**Audit limitation:** GitHub sources were inspected live, but this session could not independently load the deployed domain or NXCore. The plan records those as explicit acceptance tasks rather than asserting their completion.
