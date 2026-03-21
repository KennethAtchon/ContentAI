export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  projectId: string;
  project?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  reelRefs?: number[];
  mediaRefs?: string[];
  generatedContentId?: number;
  createdAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

export interface CreateSessionRequest {
  projectId: string;
  title?: string;
}

export interface UpdateSessionRequest {
  title?: string;
}

export interface SessionDraft {
  id: number;
  version: number;
  outputType: string;
  status: string;
  generatedHook: string | null;
  generatedScript: string | null;
  generatedCaption: string | null;
  generatedMetadata: {
    hashtags?: string[];
    cta?: string;
    contentType?: string;
    changeDescription?: string;
  } | null;
  createdAt: string;
}

export interface SendMessageRequest {
  content: string;
  reelRefs?: number[];
  mediaRefs?: string[];
  activeContentId?: number;
}

export interface SendMessageResponse {
  message: ChatMessage;
}
