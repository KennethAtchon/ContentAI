import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { invalidateUserSettingsQuery } from "@/app/query/query-invalidation";
import { queryKeys } from "@/app/query/query-keys";
import type { UserSettingsData } from "../model";
import {
  fetchAiDefaults,
  fetchPreferenceVoices,
  fetchUserSettings,
  fetchVideoDefaults,
  updateUserSettings,
} from "../api/user-preferences.service";

export function useUserPreferences() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: queryKeys.api.userSettings(),
    queryFn: fetchUserSettings,
  });

  const { data: voices, isLoading: voicesLoading } = useQuery({
    queryKey: queryKeys.api.userSettingsVoices(),
    queryFn: fetchPreferenceVoices,
    staleTime: 5 * 60 * 1000,
  });

  const { data: aiDefaults } = useQuery({
    queryKey: queryKeys.api.aiDefaults(),
    queryFn: fetchAiDefaults,
    staleTime: 5 * 60 * 1000,
  });

  const { data: videoDefaults } = useQuery({
    queryKey: queryKeys.api.videoDefaults(),
    queryFn: fetchVideoDefaults,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => {
      void invalidateUserSettingsQuery(queryClient);
    },
    onError: () => {
      toast.error(t("user_settings_save_error"));
    },
  });

  async function handleChange(field: keyof UserSettingsData, value: string) {
    setSavingField(field);
    setSavedField(null);

    try {
      await mutation.mutateAsync({
        [field]: value === "system_default" ? null : value,
      });
      setSavedField(field);
      setTimeout(() => setSavedField(null), 2000);
    } finally {
      setSavingField(null);
    }
  }

  return {
    aiDefaults,
    handleChange,
    savedField,
    savingField,
    settings,
    settingsLoading,
    videoDefaults,
    voices,
    voicesLoading,
  };
}
