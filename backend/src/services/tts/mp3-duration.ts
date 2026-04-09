const MPEG1_LAYER3_BITRATES_KBPS = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
const MPEG2_LAYER3_BITRATES_KBPS = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
];
const MPEG1_SAMPLE_RATES = [44100, 48000, 32000, 0];
const MPEG2_SAMPLE_RATES = [22050, 24000, 16000, 0];
const MPEG25_SAMPLE_RATES = [11025, 12000, 8000, 0];

/** Matches fallback heuristic used in TTS flows (~128 kbps). */
export function estimateMp3DurationMsFromBufferSize(
  byteLength: number,
): number {
  return Math.round((byteLength / 16000) * 1000);
}

function getId3v2TagSize(buffer: Buffer): number {
  if (buffer.length < 10) return 0;
  if (buffer.toString("ascii", 0, 3) !== "ID3") return 0;
  const flags = buffer[5] ?? 0;
  const hasFooter = (flags & 0x10) !== 0;
  const size =
    (((buffer[6] ?? 0) & 0x7f) << 21) |
    (((buffer[7] ?? 0) & 0x7f) << 14) |
    (((buffer[8] ?? 0) & 0x7f) << 7) |
    ((buffer[9] ?? 0) & 0x7f);
  return 10 + size + (hasFooter ? 10 : 0);
}

/**
 * Parse MP3 duration by scanning MPEG Layer III frame headers.
 * Falls back to byte-size heuristic if parsing fails.
 */
export function estimateMp3DurationMs(buffer: Buffer): number {
  const minHeaderBytes = 4;
  if (buffer.length < minHeaderBytes) {
    return estimateMp3DurationMsFromBufferSize(buffer.length);
  }

  let cursor = getId3v2TagSize(buffer);
  let totalDurationMs = 0;
  let frameCount = 0;

  while (cursor + minHeaderBytes <= buffer.length) {
    const b0 = buffer[cursor] ?? 0;
    const b1 = buffer[cursor + 1] ?? 0;
    const b2 = buffer[cursor + 2] ?? 0;

    const syncOk = b0 === 0xff && (b1 & 0xe0) === 0xe0;
    if (!syncOk) {
      cursor += 1;
      continue;
    }

    const versionBits = (b1 >> 3) & 0x03;
    const layerBits = (b1 >> 1) & 0x03;
    const bitrateIndex = (b2 >> 4) & 0x0f;
    const sampleRateIndex = (b2 >> 2) & 0x03;
    const paddingBit = (b2 >> 1) & 0x01;

    // We only handle MPEG Layer III.
    if (layerBits !== 0x01 || versionBits === 0x01) {
      cursor += 1;
      continue;
    }
    if (
      bitrateIndex === 0 ||
      bitrateIndex === 0x0f ||
      sampleRateIndex === 0x03
    ) {
      cursor += 1;
      continue;
    }

    let sampleRate = 0;
    let bitrateKbps = 0;
    let samplesPerFrame = 0;
    let frameLength = 0;

    // versionBits: 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    if (versionBits === 0x03) {
      sampleRate = MPEG1_SAMPLE_RATES[sampleRateIndex] ?? 0;
      bitrateKbps = MPEG1_LAYER3_BITRATES_KBPS[bitrateIndex] ?? 0;
      samplesPerFrame = 1152;
      frameLength =
        Math.floor((144000 * bitrateKbps) / sampleRate) + paddingBit;
    } else {
      sampleRate =
        versionBits === 0x02
          ? (MPEG2_SAMPLE_RATES[sampleRateIndex] ?? 0)
          : (MPEG25_SAMPLE_RATES[sampleRateIndex] ?? 0);
      bitrateKbps = MPEG2_LAYER3_BITRATES_KBPS[bitrateIndex] ?? 0;
      samplesPerFrame = 576;
      frameLength = Math.floor((72000 * bitrateKbps) / sampleRate) + paddingBit;
    }

    if (sampleRate <= 0 || bitrateKbps <= 0 || frameLength <= 0) {
      cursor += 1;
      continue;
    }
    if (cursor + frameLength > buffer.length) {
      break;
    }

    totalDurationMs += (samplesPerFrame * 1000) / sampleRate;
    frameCount += 1;
    cursor += frameLength;
  }

  if (frameCount === 0 || totalDurationMs <= 0) {
    return estimateMp3DurationMsFromBufferSize(buffer.length);
  }

  return Math.round(totalDurationMs);
}
