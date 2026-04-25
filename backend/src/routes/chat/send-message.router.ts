import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { usageGate } from "../../middleware/usage-gate";
import { uuidParam } from "../../validation/shared.schemas";
import { createChatSendMessageStreamResponse } from "../../domain/chat/send-message.stream";
import { sendMessageSchema } from "./chat.schemas";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const sendMessageRouter = new Hono<HonoEnv>();

sendMessageRouter.post(
  "/sessions/:id/messages",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", uuidParam, zodValidationErrorHook),
  usageGate("generation"),
  zValidator("json", sendMessageSchema),
  async (c) => {
    const auth = c.get("auth");
    const { id: sessionId } = c.req.valid("param");
    const { content, reelRefs, mediaRefs, activeContentId } =
      c.req.valid("json");

    return createChatSendMessageStreamResponse({
      auth,
      sessionId,
      content,
      reelRefs,
      mediaRefs,
      activeContentId,
    });
  },
);

export default sendMessageRouter;
