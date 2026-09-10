# EchoVerse Phase — Next Session Handoff Pointer

**Prepared:** 2026-09-10  
**Repository:** `aerovista-us/phase`  
**Live alpha:** `https://phase.aerovista.us/`  
**Current visible version:** **Phase 0.13.0**  
**Project schema:** `v12`  
**Session storage key:** `echoverse.phase.session.v5`

The current comprehensive continuation handoff is:

`docs/PHASE_COMPREHENSIVE_HANDOFF_2026-09-10.md`

Read that file first. It supersedes the prior 0.12.8 continuation assumptions where they conflict with the current repository.

The key architectural change is already implemented: source audio remains immutable and the edit map remains authoritative, but DSP-affecting edits now debounce into cancellable disposable FAST audio previews. Explicit rendering remains the selected final-quality path, and export guarantees final-current audio before writing WAV.

Application baseline documented by the comprehensive handoff:

`bf98617815a677a60d476a7024070dd6e7163a03`

The handoff itself was added afterward, so the literal `main` head will be newer than that application baseline. Always inspect the latest repository and Actions state before modifying code.
