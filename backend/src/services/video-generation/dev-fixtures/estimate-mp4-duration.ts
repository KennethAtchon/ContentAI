function readBox(
  buf: Buffer,
  offset: number,
): { type: string; headerSize: number; totalSize: number } | null {
  if (offset + 8 > buf.length) return null;
  let size = buf.readUInt32BE(offset);
  const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
  if (size < 8) return null;
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > buf.length) return null;
    size = Number(buf.readBigUInt64BE(offset + 8));
    headerSize = 16;
  }
  if (!Number.isFinite(size) || size < headerSize) return null;
  return { type, headerSize, totalSize: size };
}

function readMvhdDurationSeconds(
  buf: Buffer,
  dataStart: number,
): number | null {
  if (dataStart + 1 > buf.length) return null;
  const version = buf[dataStart];
  if (version === 1) {
    if (dataStart + 32 > buf.length) return null;
    const timescale = buf.readUInt32BE(dataStart + 20);
    const duration = Number(buf.readBigUInt64BE(dataStart + 24));
    if (!timescale || duration < 0) return null;
    return duration / timescale;
  }
  if (dataStart + 20 > buf.length) return null;
  const timescale = buf.readUInt32BE(dataStart + 12);
  const duration = buf.readUInt32BE(dataStart + 16);
  if (!timescale || duration === 0xffffffff) return null;
  return duration / timescale;
}

function findMvhdInMoov(
  buf: Buffer,
  moovBodyStart: number,
  moovBodyLength: number,
): number | null {
  let offset = moovBodyStart;
  const end = moovBodyStart + moovBodyLength;
  while (offset + 8 <= end && offset + 8 <= buf.length) {
    const box = readBox(buf, offset);
    if (!box) return null;
    if (box.type === "mvhd") {
      const dataStart = offset + box.headerSize;
      return readMvhdDurationSeconds(buf, dataStart);
    }
    offset += box.totalSize;
  }
  return null;
}

/**
 * Reads `moov`/`mvhd` duration (seconds). Used for dev fixture MP4s so stored
 * `durationMs` matches the actual file instead of the requested clip length.
 */
export function estimateMp4DurationSecondsFromBuffer(
  buf: Buffer,
): number | null {
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const box = readBox(buf, offset);
    if (!box) return null;
    if (box.type === "moov") {
      const bodyLen = box.totalSize - box.headerSize;
      const sec = findMvhdInMoov(buf, offset + box.headerSize, bodyLen);
      return sec != null && Number.isFinite(sec) && sec > 0 ? sec : null;
    }
    offset += box.totalSize;
  }
  return null;
}

const PROBE_SANITY_MAX_SEC = 600;

/**
 * Prefer measured MP4 duration; otherwise use fallback (e.g. API-requested length).
 */
export function resolveVideoOutputDurationSeconds(
  buffer: Buffer,
  fallbackSeconds: number,
): number {
  const probed = estimateMp4DurationSecondsFromBuffer(buffer);
  if (probed != null && probed > 0 && Number.isFinite(probed)) {
    return Math.min(PROBE_SANITY_MAX_SEC, Math.max(0.05, probed));
  }
  const f = Number(fallbackSeconds);
  if (!Number.isFinite(f) || f <= 0) {
    return 3;
  }
  return Math.min(PROBE_SANITY_MAX_SEC, Math.max(0.05, f));
}
