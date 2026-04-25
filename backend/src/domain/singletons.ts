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
import { EditorRepository } from "./editor/editor.repository";
import { EditorService } from "./editor/editor.service";
import { SyncService } from "./editor/sync/sync.service";
import { QueueRepository } from "./queue/queue.repository";
import { QueueService } from "./queue/queue.service";
import { ReelsRepository } from "./reels/reels.repository";
import { ReelsService } from "./reels/reels.service";
import { AdminRepository } from "./admin/admin.repository";
import { AdminService } from "./admin/admin.service";
import { PublicRepository } from "./public/public.repository";
import { PublicService } from "./public/public.service";
import { CustomerRepository } from "./customer/customer.repository";
import { CustomerService } from "./customer/customer.service";
import { UsersRepository } from "./users/users.repository";
import { UsersService } from "./users/users.service";
import { ChatRepository } from "./chat/chat.repository";
import { ChatService } from "./chat/chat.service";
import {
  ChatToolsRepository,
  type IChatToolsRepository,
} from "./chat/chat-tools.repository";
import { ProjectsRepository } from "./projects/projects.repository";
import { ProjectsService } from "./projects/projects.service";
import { ConfigRepository } from "./config/config.repository";
import { ScrapingRepository } from "./scraping/scraping.repository";
import { ScrapingService } from "../services/scraping/scraping.service";
import { SystemConfigService } from "../services/config/system-config.service";
import { UserSettingsService } from "../services/config/user-settings.service";

export const configRepository = new ConfigRepository(db);
export const systemConfigService = new SystemConfigService(configRepository);
export const userSettingsService = new UserSettingsService(configRepository);

export const authRepository = new AuthRepository(db);
export const authService = new AuthService(authRepository);

export const assetsRepository = new AssetsRepository(db);
export const assetsService = new AssetsService(assetsRepository);

export const contentRepository = new ContentRepository(db);
export const contentService = new ContentService(
  contentRepository,
  assetsRepository,
);

export const musicRepository = new MusicRepository(db);
export const musicService = new MusicService(musicRepository);

export const audioRepository = new AudioRepository(db);
export const audioService = new AudioService(audioRepository, assetsRepository);

export const editorRepository = new EditorRepository(db);

export const queueRepository = new QueueRepository(db);
export const queueService = new QueueService(queueRepository, editorRepository);

export const syncService = new SyncService(
  editorRepository,
  contentRepository,
);

export const editorService = new EditorService(
  editorRepository,
  contentRepository,
  queueRepository,
  syncService,
);

export const adminRepository = new AdminRepository(db);
export const adminService = new AdminService(adminRepository);

export const customerRepository = new CustomerRepository(db);
export const customerService = new CustomerService(customerRepository);

export const reelsRepository = new ReelsRepository(db);
export const reelsService = new ReelsService(
  reelsRepository,
  customerRepository,
);

export const scrapingRepository = new ScrapingRepository(db);
export const scrapingService = new ScrapingService(scrapingRepository, (id) =>
  reelsService.runBackgroundReelAnalysis(id),
);

export const publicRepository = new PublicRepository(db);
export const publicService = new PublicService(publicRepository);

export const usersRepository = new UsersRepository(db);
export const usersService = new UsersService(usersRepository);

export const chatRepository = new ChatRepository(db);
export const chatToolsRepository: IChatToolsRepository =
  new ChatToolsRepository(db);
export const chatService = new ChatService(chatRepository);

export const projectsRepository = new ProjectsRepository(db);
export const projectsService = new ProjectsService(projectsRepository);
