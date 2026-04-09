export class FontLoader {
  readonly ready: Promise<void>;
  private loads = new Map<string, Promise<void>>();

  constructor() {
    this.ready = Promise.resolve();
  }

  load(fontFamily: string, url: string): Promise<void> {
    const key = `${fontFamily}::${url}`;
    const existing = this.loads.get(key);
    if (existing) return existing;

    const promise = (async () => {
      const documentWithFonts = document as typeof document & {
        fonts?: { add: (face: unknown) => void };
      };
      if (
        typeof globalThis.FontFace === "undefined" ||
        !documentWithFonts.fonts
      ) {
        return;
      }
      try {
        const face = new globalThis.FontFace(fontFamily, `url(${url})`);
        await face.load();
        documentWithFonts.fonts.add(face);
      } catch {
        return;
      }
    })();

    this.loads.set(key, promise);
    return promise;
  }
}
