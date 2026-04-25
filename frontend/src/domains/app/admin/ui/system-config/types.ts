export interface TtsVoice {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  description: string;
  elevenLabsId: string;
}

export interface VoiceFormState {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  description: string;
  elevenLabsId: string;
}

export interface AiProviderStatusEntry {
  id: string;
  label: string;
  active: boolean;
  analysisModel: string;
  generationModel: string;
}

export interface AiProvidersStatusResponse {
  providers: AiProviderStatusEntry[];
  defaultProvider: string | null;
}

export interface VideoProviderStatusEntry {
  id: string;
  label: string;
  active: boolean;
  model: string;
}

export interface VideoProvidersStatusResponse {
  providers: VideoProviderStatusEntry[];
  defaultProvider: string | null;
  configuredDefault: string;
}

export interface ApiKeyStatusEntry {
  active: boolean;
  source: "db" | "env" | "none";
}

export interface ApiKeysStatusResponse {
  keys: Record<string, ApiKeyStatusEntry>;
}
