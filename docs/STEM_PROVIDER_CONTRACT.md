# Phase Stem Separation Provider Contract

Phase keeps stem separation outside the browser editor's core architecture. A provider may run on NXCore, another local workstation, or another user-controlled service. Phase only needs the HTTP contract below.

The browser/PWA remains useful without any provider because users can manually load Vocals / Drums / Bass / Other files from the **STEMS** drawer.

## Canonical output slots

A separation provider may return any subset of these canonical slots:

- `vocals`
- `drums`
- `bass`
- `other`

At least one recognized slot must be returned. Extra provider-specific outputs are ignored by the Phase client unless a later Phase version adds a mapping for them.

The original mix remains the timing-analysis authority. Returned stems inherit that track's beat grid, warp map, pitch shift, project placement, trim points and fades.

## Create a job

`POST /v1/stem-jobs`

Content type: `multipart/form-data`

Fields:

- `audio` — source audio file
- `preset` — currently `4stem`
- `trackLabel` — optional display context such as `TRACK A`

Example response:

```json
{
  "id": "stem_01J...",
  "status": "queued",
  "progress": 0.02
}
```

A provider may instead include an explicit `statusUrl`:

```json
{
  "id": "stem_01J...",
  "statusUrl": "/v1/stem-jobs/stem_01J..."
}
```

## Poll a job

`GET /v1/stem-jobs/{id}`

While running:

```json
{
  "id": "stem_01J...",
  "status": "running",
  "progress": 0.47
}
```

Failure:

```json
{
  "id": "stem_01J...",
  "status": "failed",
  "message": "separator process failed"
}
```

Completion:

```json
{
  "id": "stem_01J...",
  "status": "complete",
  "progress": 1,
  "stems": {
    "vocals": {
      "url": "/v1/stem-jobs/stem_01J.../vocals.wav",
      "fileName": "vocals.wav"
    },
    "drums": "/v1/stem-jobs/stem_01J.../drums.wav",
    "bass": "/v1/stem-jobs/stem_01J.../bass.wav",
    "other": "/v1/stem-jobs/stem_01J.../other.wav"
  }
}
```

A job may return `complete` directly from the initial POST.

## Stem downloads

Each stem URL must respond to `GET` with decodable audio. WAV is preferred for lossless editing, but Phase uses Web Audio decoding and can accept other browser-decodable audio formats.

Provider URLs may be absolute or relative to the configured provider endpoint.

## Browser requirements

If the provider is on another origin, it must permit the Phase origin:

`https://phase.aerovista.us`

CORS must permit:

- `POST` to the job endpoint
- `GET` to status and stem-download endpoints
- any authentication headers chosen for the eventual deployment

Phase does not require cookies for this contract. A later authenticated NXCore deployment should prefer a short-lived bearer/token mechanism rather than exposing permanent credentials in the PWA.

## Cancellation

The Phase client uses `AbortSignal` to stop upload, polling, or stem downloads. Aborting the browser request does not currently require the provider to cancel server-side compute. A future optional endpoint may add server-side cancellation without changing the basic result contract.

## Progress

`progress` is a floating-point value from `0` to `1`. It is advisory. Phase also reports upload, queued/running, download and complete stages in the UI.

## Local-first boundary

A configured provider is optional. Manual stem import remains the offline/local fallback. The source file and generated stems are never written into the Phase GitHub Pages application or project JSON; project maps persist filenames and mix settings only.
