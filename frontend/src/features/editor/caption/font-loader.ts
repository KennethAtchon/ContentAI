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
      if (typeof FontFace === "undefined" || !("fonts" in document)) {
        return;
      }
      try {
        const face = new FontFace(fontFamily, `url(${url})`);
        await face.load();
        (document as Document & { fonts: FontFaceSet }).fonts.add(face);
      } catch {
        // Fail open. Renderer can fall back to browser fonts.
      }
    })();

    this.loads.set(key, promise);
    return promise;
  }
}
