/**
 * Shared domain layer instances (repositories + services).
 * Routes and middleware import from here; tests can override via module mocks if needed.
 */
import { db } from "../services/db/db";
import { AuthRepository } from "./auth/auth.repository";
import { AuthService } from "./auth/auth.service";
import { AssetsRepository } from "./assets/assets.repository";
import { AssetsService } from "./assets/assets.service";
import { ContentRepository } from "./content/content.repository";
import { ContentService } from "./content/content.service";
import { AudioRepository } from "./audio/audio.repository";
import { AudioService } from "./audio/audio.service";
import { MusicRepository } from "./music/music.repository";
import { MusicService } from "./music/music.service";
import { CaptionsRepository } from "./editor/captions.repository";
import { CaptionsService } from "./editor/captions.service";
import { EditorRepository } from "./editor/editor.repository";
import { EditorService } from "./editor/editor.service";
import { QueueRepository } from "./queue/queue.repository";
import { QueueService } from "./queue/queue.service";
import { ReelsRepository } from "./reels/reels.repository";
import { ReelsService } from "./reels/reels.service";
import { AdminRepository } from "./admin/admin.repository";
import { AdminService } from "./admin/admin.service";
import { PublicRepository } from "./public/public.repository";
import { PublicService } from "./public/public.service";

export const authRepository = new AuthRepository(db);
export const authService = new AuthService(authRepository);

export const assetsRepository = new AssetsRepository(db);
export const assetsService = new AssetsService(assetsRepository);

export const captionsRepository = new CaptionsRepository(db);
export const captionsService = new CaptionsService(
  assetsRepository,
  captionsRepository,
);

export const contentRepository = new ContentRepository(db);
export const contentService = new ContentService(contentRepository);

export const musicRepository = new MusicRepository(db);
export const musicService = new MusicService(musicRepository);

export const audioRepository = new AudioRepository(db);
export const audioService = new AudioService(audioRepository, assetsRepository);

export const editorRepository = new EditorRepository(db);

export const queueRepository = new QueueRepository(db);
export const queueService = new QueueService(queueRepository, editorRepository);

export const editorService = new EditorService(
  editorRepository,
  contentRepository,
  queueRepository,
);

export const adminRepository = new AdminRepository(db);
export const adminService = new AdminService(adminRepository);

export const reelsRepository = new ReelsRepository(db);
export const reelsService = new ReelsService(reelsRepository);

export const publicRepository = new PublicRepository(db);
export const publicService = new PublicService(publicRepository);
