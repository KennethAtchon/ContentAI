import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  estimateMp4DurationSecondsFromBuffer,
  resolveVideoOutputDurationSeconds,
} from "@/services/video-generation/dev-fixtures/estimate-mp4-duration";

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

describe("estimateMp4DurationSecondsFromBuffer", () => {
  test("resolveVideoOutputDurationSeconds matches probe for valid MP4", () => {
    const mvhdBody = Buffer.concat([
      Buffer.from([0, 0, 0, 0]),
      u32(0),
      u32(0),
      u32(100),
      u32(800),
    ]);
    const mvhdSize = 8 + mvhdBody.length;
    const mvhd = Buffer.concat([u32(mvhdSize), Buffer.from("mvhd"), mvhdBody]);
    const moovSize = 8 + mvhd.length;
    const moov = Buffer.concat([u32(moovSize), Buffer.from("moov"), mvhd]);
    const ftypBody = Buffer.alloc(8, 0);
    const ftypSize = 8 + ftypBody.length;
    const ftyp = Buffer.concat([u32(ftypSize), Buffer.from("ftyp"), ftypBody]);
    const file = Buffer.concat([ftyp, moov]);
    expect(resolveVideoOutputDurationSeconds(file, 99)).toBeCloseTo(8, 5);
  });

  test("reads mvhd v0 duration (15s at timescale 600)", () => {
    const mvhdBody = Buffer.concat([
      Buffer.from([0, 0, 0, 0]),
      u32(0),
      u32(0),
      u32(600),
      u32(9000),
    ]);
    const mvhdSize = 8 + mvhdBody.length;
    const mvhd = Buffer.concat([u32(mvhdSize), Buffer.from("mvhd"), mvhdBody]);
    const moovSize = 8 + mvhd.length;
    const moov = Buffer.concat([u32(moovSize), Buffer.from("moov"), mvhd]);
    const ftypBody = Buffer.alloc(8, 0);
    const ftypSize = 8 + ftypBody.length;
    const ftyp = Buffer.concat([u32(ftypSize), Buffer.from("ftyp"), ftypBody]);
    const file = Buffer.concat([ftyp, moov]);
    expect(estimateMp4DurationSecondsFromBuffer(file)).toBeCloseTo(15, 5);
  });

  test("fixture dev-mock-clip-1.mp4 reports real duration when present", () => {
    const dir = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../fixtures/media",
    );
    const path = join(dir, "dev-mock-clip-1.mp4");
    if (!existsSync(path)) {
      console.warn(`skip: missing fixture at ${path}`);
      return;
    }
    const buf = readFileSync(path);
    const sec = estimateMp4DurationSecondsFromBuffer(buf);
    expect(sec).not.toBeNull();
    expect(sec!).toBeGreaterThan(10);
  });
});
