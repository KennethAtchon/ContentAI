import { authenticatedFetch, authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import type { VideoJobResponse } from "@/features/video/types/video.types";
import type {
  Project,
  ChatSession,
  ChatMessage,
  SessionDraft,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateSessionRequest,
  UpdateSessionRequest,
  SendMessageRequest,
  SendMessageResponse,
} from "../types/chat.types";

const API_BASE = "/api";

export const chatService = {
  // Projects
  async getProjects(): Promise<Project[]> {
    const response = await authenticatedFetch(`${API_BASE}/projects`);
    if (!response.ok) {
      throw new Error("Failed to fetch projects");
    }
    const data = await response.json();
    return data.projects;
  },

  async getProject(id: string): Promise<Project> {
    const response = await authenticatedFetch(`${API_BASE}/projects/${id}`);
    if (!response.ok) {
      throw new Error("Failed to fetch project");
    }
    const data = await response.json();
    return data.project;
  },

  async createProject(project: CreateProjectRequest): Promise<Project> {
    const response = await authenticatedFetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(project),
    });
    if (!response.ok) {
      throw new Error("Failed to create project");
    }
    const data = await response.json();
    return data.project;
  },

  async updateProject(
    id: string,
    updates: UpdateProjectRequest
  ): Promise<Project> {
    const response = await authenticatedFetch(`${API_BASE}/projects/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error("Failed to update project");
    }
    const data = await response.json();
    return data.project;
  },

  async deleteProject(id: string): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/projects/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to delete project");
    }
  },

  // Chat Sessions
  async getChatSessions(projectId?: string): Promise<ChatSession[]> {
    const url = projectId
      ? `${API_BASE}/chat/sessions?projectId=${projectId}`
      : `${API_BASE}/chat/sessions`;
    const response = await authenticatedFetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch chat sessions");
    }
    const data = await response.json();
    return data.sessions;
  },

  async getChatSession(
    id: string
  ): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
    const response = await authenticatedFetch(
      `${API_BASE}/chat/sessions/${id}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch chat session");
    }
    return response.json();
  },

  async createChatSession(session: CreateSessionRequest): Promise<ChatSession> {
    const response = await authenticatedFetch(`${API_BASE}/chat/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(session),
    });
    if (!response.ok) {
      throw new Error("Failed to create chat session");
    }
    const data = await response.json();
    return data.session;
  },

  async deleteChatSession(id: string): Promise<void> {
    const response = await authenticatedFetch(
      `${API_BASE}/chat/sessions/${id}`,
      {
        method: "DELETE",
      }
    );
    if (!response.ok) {
      throw new Error("Failed to delete chat session");
    }
  },

  async updateChatSession(
    id: string,
    updates: UpdateSessionRequest
  ): Promise<ChatSession> {
    const data = await authenticatedFetchJson<{ session: ChatSession }>(
      `${API_BASE}/chat/sessions/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(updates),
      }
    );
    return data.session;
  },

  updateSessionMetadata(
    id: string,
    updates: UpdateSessionRequest
  ): Promise<ChatSession> {
    return this.updateChatSession(id, updates);
  },

  // Session drafts / generated content
  getSessionDrafts(sessionId: string): Promise<{ drafts: SessionDraft[] }> {
    return authenticatedFetchJson(`${API_BASE}/chat/sessions/${sessionId}/content`);
  },

  // Queue
  async addToQueue(generatedContentId: number): Promise<unknown> {
    const response = await authenticatedFetch(`${API_BASE}/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generatedContentId }),
    });
    if (!response.ok) throw new Error("Failed to send to queue");
    return response.json();
  },

  // Chat Messages
  async streamMessage(
    sessionId: string,
    message: SendMessageRequest,
    timeoutMs = 120_000,
    signal?: AbortSignal
  ): Promise<Response> {
    return authenticatedFetch(
      `${API_BASE}/chat/sessions/${sessionId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
        signal,
      },
      timeoutMs
    );
  },

  async sendMessage(
    sessionId: string,
    message: SendMessageRequest
  ): Promise<SendMessageResponse> {
    const response = await authenticatedFetch(
      `${API_BASE}/chat/sessions/${sessionId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      }
    );
    if (!response.ok) {
      throw new Error("Failed to send message");
    }
    return response.json();
  },

  // Video jobs (used by chat experience to resume reel generation state)
  getVideoJob(jobId: string): Promise<VideoJobResponse> {
    return authenticatedFetchJson<VideoJobResponse>(`${API_BASE}/video/jobs/${jobId}`);
  },
};
