import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { getFileUrl, uploadFile } from "../../services/storage/r2";
import { contentService } from "../../domain/singletons";
import { parseUserAssetUploadForm } from "../../domain/assets/user-upload";

const uploadRouter = new Hono<HonoEnv>();

uploadRouter.post(
  "/upload",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");
    const form = await c.req.formData();

    const {
      file: fileEntry,
      generatedContentId,
      assetType: parsedType,
      shotIndex,
    } = parseUserAssetUploadForm(form);

    const mime = fileEntry.type.toLowerCase();
    const isVideo = parsedType === "video_clip";

    const ext = fileEntry.name.includes(".")
      ? fileEntry.name.split(".").pop()!.toLowerCase()
      : isVideo
        ? "mp4"
        : "jpg";

    const assetId = crypto.randomUUID();
    const r2Key = `media/uploads/${auth.user.id}/${assetId}.${ext}`;
    const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
    const r2Url = await uploadFile(fileBuffer, r2Key, mime);

    const asset = await contentService.createUserUploadForGeneratedContent(
      auth.user.id,
      generatedContentId,
      {
        id: assetId,
        userId: auth.user.id,
        type: parsedType,
        source: "uploaded",
        name: fileEntry.name,
        mimeType: mime,
        r2Key,
        r2Url,
        sizeBytes: fileEntry.size,
        durationMs: null,
        metadata: {
          shotIndex,
          hasEmbeddedAudio: isVideo,
          useClipAudio: false,
          originalName: fileEntry.name,
        },
      },
      parsedType,
    );

    const mediaUrl = await getFileUrl(r2Key, 3600).catch(() => r2Url);
    return c.json({ asset: { ...asset, mediaUrl } }, 201);
  },
);

export default uploadRouter;
