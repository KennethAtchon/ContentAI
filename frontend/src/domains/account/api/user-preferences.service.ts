import { authenticatedFetchJson } from "@/shared/api/authenticated-fetch";
import type {
  AiDefaultsData,
  UserSettingsData,
  VideoDefaultsData,
  Voice,
} from "../model";

export function fetchUserSettings(): Promise<UserSettingsData> {
  return authenticatedFetchJson<UserSettingsData>("/api/customer/settings");
}

export async function fetchPreferenceVoices(): Promise<Voice[]> {
  const response =
    await authenticatedFetchJson<{ voices: Voice[] }>("/api/audio/voices");
  return response.voices;
}

export function fetchAiDefaults(): Promise<AiDefaultsData> {
  return authenticatedFetchJson<AiDefaultsData>(
    "/api/customer/settings/ai-defaults",
  );
}

export function fetchVideoDefaults(): Promise<VideoDefaultsData> {
  return authenticatedFetchJson<VideoDefaultsData>(
    "/api/customer/settings/video-defaults",
  );
}

export function updateUserSettings(
  data: Partial<UserSettingsData>,
): Promise<UserSettingsData> {
  return authenticatedFetchJson<UserSettingsData>("/api/customer/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
