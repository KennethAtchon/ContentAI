import { describe, expect, it } from "bun:test";
import {
  assertSafeRemoteUrl,
  isAllowedRemoteHost,
  isPrivateOrLoopbackIp,
} from "@/utils/security/remote-url-guard";

describe("remote-url-guard", () => {
  it("allows expected instagram cdn hosts over https", async () => {
    const url = await assertSafeRemoteUrl(
      "https://scontent.cdninstagram.com/v/t50.2886-16/123.mp4",
      {
        resolveHost: async () => ["157.240.22.1"],
      },
    );

    expect(url.hostname).toBe("scontent.cdninstagram.com");
  });

  it("rejects non-https urls", async () => {
    await expect(
      assertSafeRemoteUrl("http://scontent.cdninstagram.com/test.mp4", {
        resolveHost: async () => ["157.240.22.1"],
      }),
    ).rejects.toThrow("HTTPS");
  });

  it("rejects non-allowlisted hosts", async () => {
    expect(isAllowedRemoteHost("example.com")).toBe(false);
  });

  it("rejects private and loopback addresses", () => {
    expect(isPrivateOrLoopbackIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrLoopbackIp("10.0.0.8")).toBe(true);
    expect(isPrivateOrLoopbackIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrLoopbackIp("::1")).toBe(true);
    expect(isPrivateOrLoopbackIp("fe80::1")).toBe(true);
    expect(isPrivateOrLoopbackIp("157.240.22.1")).toBe(false);
  });

  it("rejects allowlisted hosts that resolve private", async () => {
    await expect(
      assertSafeRemoteUrl("https://www.instagram.com/reel/test", {
        resolveHost: async () => ["127.0.0.1"],
      }),
    ).rejects.toThrow("private address");
  });
});
