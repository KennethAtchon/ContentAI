# Dev mock media fixtures

Binary files used when `DEV_MOCK_EXTERNAL_INTEGRATIONS=true` and `APP_ENV=development` (see `docs/plans/dev-mock-external-integrations.md`).

| File                                          | Format | Purpose                                                                                 |
| --------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| `dev-mock-clip-1.mp4` … `dev-mock-clip-4.mp4` | MPEG-4 | Four distinct samples; `generateVideoClip` picks one from `metadata.shotIndex` (mod 4). |
| `dev-mock-voiceover.mp3`                      | MP3    | Returned as the buffer for mocked ElevenLabs TTS (`generateSpeech`).                    |

## Sources

| Fixture                  | Origin                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev-mock-clip-1.mp4`    | [Google GTV samples — `ForBiggerBlazes.mp4`](https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4) (distinct promo clip)    |
| `dev-mock-clip-2.mp4`    | [Google GTV samples — `ForBiggerEscapes.mp4`](https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4) (different promo clip) |
| `dev-mock-clip-3.mp4`    | [MDN interactive examples — `flower.mp4` (CC0)](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4)                          |
| `dev-mock-clip-4.mp4`    | [W3Schools — `mov_bbb.mp4` (Big Buck Bunny excerpt, tutorial sample)](https://www.w3schools.com/html/mov_bbb.mp4)                                  |
| `dev-mock-voiceover.mp3` | [FileSamples — `sample3.mp3`](https://filesamples.com/samples/audio/mp3/sample3.mp3)                                                               |

Re-download if missing:

```bash
cd backend/fixtures/media
curl -fsSL -o dev-mock-clip-1.mp4 "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
curl -fsSL -o dev-mock-clip-2.mp4 "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
curl -fsSL -o dev-mock-clip-3.mp4 "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
curl -fsSL -o dev-mock-clip-4.mp4 "https://www.w3schools.com/html/mov_bbb.mp4"
curl -fsSL -o dev-mock-voiceover.mp3 "https://filesamples.com/samples/audio/mp3/sample3.mp3"
```
