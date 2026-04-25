import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useAuthenticatedFetch } from "@/domains/auth/hooks/use-authenticated-fetch";
import { invalidateAfterAdminSystemConfigCacheFlush } from "@/app/query/query-invalidation";
import { Button } from "@/shared/ui/primitives/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/primitives/tabs";
import { cn } from "@/shared/lib/utils";
import { AiTab } from "./tabs/AiTab";
import { VideoTab } from "./tabs/VideoTab";
import { SubscriptionTab } from "./tabs/SubscriptionTab";
import { FeatureFlagsTab } from "./tabs/FeatureFlagsTab";
import { ContentTab } from "./tabs/ContentTab";
import { TtsTab } from "./tabs/TtsTab";
import { ApiKeysTab } from "./tabs/ApiKeysTab";

export function SystemConfigView() {
  const { t } = useTranslation();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleCacheInvalidate = async () => {
    setRefreshing(true);
    try {
      await authenticatedFetchJson("/api/admin/config/cache/invalidate", {
        method: "POST",
        body: JSON.stringify({ category: "all" }),
      });
      await invalidateAfterAdminSystemConfigCacheFlush(queryClient);
      toast.success("Config cache invalidated");
    } catch {
      toast.error("Failed to invalidate cache");
    } finally {
      setRefreshing(false);
    }
  };

  const TABS = [
    { value: "ai", label: t("admin_config_ai_tab") },
    { value: "video", label: t("admin_config_video_tab") },
    { value: "subscription", label: t("admin_config_subscription_tab") },
    { value: "feature_flags", label: t("admin_config_flags_tab") },
    { value: "content", label: t("admin_config_content_tab") },
    { value: "tts", label: t("admin_config_tts_tab") },
    { value: "api_keys", label: t("admin_config_api_keys_tab") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-studio-fg">
            {t("admin_system_config_title")}
          </h2>
          <p className="text-sm text-dim-2 mt-1">
            {t("admin_system_config_subtitle")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-dim-2 hover:text-studio-fg"
          onClick={handleCacheInvalidate}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Invalidate Cache
        </Button>
      </div>

      <Tabs defaultValue="ai">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-overlay-sm p-1 rounded-xl w-full justify-start">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-sm data-[state=active]:bg-studio-surface data-[state=active]:text-studio-fg data-[state=active]:shadow-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="ai">
            <AiTab />
          </TabsContent>
          <TabsContent value="video">
            <VideoTab />
          </TabsContent>
          <TabsContent value="subscription">
            <SubscriptionTab />
          </TabsContent>
          <TabsContent value="feature_flags">
            <FeatureFlagsTab />
          </TabsContent>
          <TabsContent value="content">
            <ContentTab />
          </TabsContent>
          <TabsContent value="tts">
            <TtsTab />
          </TabsContent>
          <TabsContent value="api_keys">
            <ApiKeysTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
