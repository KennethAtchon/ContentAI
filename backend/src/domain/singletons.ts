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
import { EditorRepository } from "./editor/editor.repository";
import { QueueRepository } from "./queue/queue.repository";
import { QueueService } from "./queue/queue.service";
import { AdminRepository } from "./admin/admin.repository";
import { AdminService } from "./admin/admin.service";

export const authRepository = new AuthRepository(db);
export const authService = new AuthService(authRepository);

export const assetsRepository = new AssetsRepository(db);
export const assetsService = new AssetsService(assetsRepository);

export const contentRepository = new ContentRepository(db);
export const contentService = new ContentService(contentRepository);

export const editorRepository = new EditorRepository(db);

export const queueRepository = new QueueRepository(db);
export const queueService = new QueueService(queueRepository);

export const adminRepository = new AdminRepository(db);
export const adminService = new AdminService(adminRepository);
