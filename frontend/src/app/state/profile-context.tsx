import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authenticatedFetchJson } from "@/shared/api/authenticated-fetch";
import { addTimezoneHeader } from "@/shared/api/add-timezone-header";
import { debugLog } from "@/shared/debug";
import { queryKeys } from "@/app/query/query-keys";
import { QUERY_STALE } from "@/app/query/query-client";
import { useAuth } from "./auth-context";
import type { UserProfile } from "./types";

export interface ProfileContextValue {
  profile: UserProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  isOAuthUser: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

export function useProfile(): ProfileContextValue {
  const { user, authLoading, backendReady } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: profileResponse,
    error: profileQueryError,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: queryKeys.api.profile(),
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");
      const token = await user.getIdToken();
      return authenticatedFetchJson<{
        profile: UserProfile;
        isOAuthUser: boolean;
      }>(
        "/api/customer/profile",
        addTimezoneHeader({
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })
      );
    },
    enabled: !!user && !authLoading && backendReady,
    staleTime: QUERY_STALE.long,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    gcTime: QUERY_STALE.long,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * attemptIndex, 3000),
  });

  const profile = useMemo(
    () => profileResponse?.profile ?? null,
    [profileResponse]
  );
  const isOAuthUser = useMemo(
    () => profileResponse?.isOAuthUser ?? false,
    [profileResponse]
  );
  const isAdmin = useMemo(() => profile?.role === "admin", [profile?.role]);

  const profileError = useMemo(
    () =>
      profileQueryError
        ? profileQueryError instanceof Error
          ? profileQueryError.message
          : "Failed to fetch user profile"
        : null,
    [profileQueryError]
  );

  const refreshProfile = useCallback(async () => {
    await refetchProfile();
  }, [refetchProfile]);

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!user || !profile) {
        throw new Error("User must be authenticated to update profile");
      }

      try {
        const response = await authenticatedFetchJson<{
          message: string;
          profile: UserProfile;
        }>("/api/customer/profile", {
          method: "PUT",
          body: JSON.stringify(updates),
        });

        if (!response.profile) {
          throw new Error("Profile data not found in response");
        }

        queryClient.setQueryData(queryKeys.api.profile(), {
          profile: response.profile,
          isOAuthUser: profileResponse?.isOAuthUser ?? false,
        });

        debugLog.info("User profile updated successfully", {
          service: "profile-hook",
          operation: "updateProfile",
          userId: profile.id,
        });
      } catch (error) {
        debugLog.error(
          "Failed to update user profile",
          {
            service: "profile-hook",
            operation: "updateProfile",
            userId: profile.id,
          },
          error
        );
        throw error;
      }
    },
    [profile, profileResponse?.isOAuthUser, queryClient, user]
  );

  return useMemo(
    () => ({
      profile,
      profileLoading,
      profileError,
      isOAuthUser,
      isAdmin,
      refreshProfile,
      updateProfile,
    }),
    [
      profile,
      profileLoading,
      profileError,
      isOAuthUser,
      isAdmin,
      refreshProfile,
      updateProfile,
    ]
  );
}
