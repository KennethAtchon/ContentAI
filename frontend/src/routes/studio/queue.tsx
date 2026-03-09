import "@/styles/studio.css";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useApp } from "@/shared/contexts/app-context";
import type { QueueItem } from "@/features/reels/types/reel.types";

type StatusFilter = "all" | "scheduled" | "posted" | "failed";

function QueuePage() {
  const { t } = useTranslation();
  const [inputNiche, setInputNiche] = useState("personal finance");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { user } = useApp();
  const fetcher = useQueryFetcher<{ items: QueueItem[]; total: number }>();
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.api.queue({ status: statusFilter === "all" ? undefined : statusFilter }),
    queryFn: () => {
      const params = statusFilter !== "all" ? `&status=${statusFilter}` : "";
      return fetcher(`/api/queue?limit=20${params}`);
    },
    enabled: !!user,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      await authenticatedFetch(`/api/queue/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.api.queue() });
    },
  });

  const items = data?.items ?? [];

  const filters: StatusFilter[] = ["all", "scheduled", "posted", "failed"];

  return (
    <AuthGuard authType="user">
      <div className="ais-root">
        <StudioTopBar
          niche={inputNiche}
          onNicheChange={setInputNiche}
          onScan={() => setInputNiche(inputNiche)}
          activeTab="queue"
        />

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <div className="ais-queue-view">
            <div className="ais-queue-header">
              <div className="ais-queue-title">
                {t("studio_queue_title")}
                {data && (
                  <span
                    className="ais-sidebar-count"
                    style={{ marginLeft: 8, verticalAlign: "middle" }}
                  >
                    {data.total}
                  </span>
                )}
              </div>
            </div>

            <div className="ais-queue-filters">
              {filters.map((f) => (
                <button
                  key={f}
                  className={`ais-filter-btn ${statusFilter === f ? "active" : ""}`}
                  onClick={() => setStatusFilter(f)}
                >
                  {t(`studio_queue_filter_${f}`)}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="ais-skeleton"
                    style={{ height: 88, borderRadius: 14, marginBottom: 10 }}
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="ais-empty" style={{ paddingTop: 80 }}>
                <div className="ais-empty-icon">📅</div>
                <div className="ais-empty-title">{t("studio_queue_empty")}</div>
                <div className="ais-empty-sub">{t("studio_queue_emptySub")}</div>
              </div>
            ) : (
              items.map((item) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  onDelete={() => deleteItem.mutate(item.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function QueueCard({
  item,
  onDelete,
}: {
  item: QueueItem;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  const formattedDate = item.scheduledFor
    ? new Date(item.scheduledFor).toLocaleString()
    : t("studio_queue_unscheduled");

  return (
    <div className="ais-queue-card">
      <div className="ais-queue-card-header">
        <div className="ais-queue-card-hook">
          {t("studio_queue_itemLabel")} #{item.id}
        </div>
        <span className={`ais-status-badge ais-status-${item.status}`}>
          {item.status}
        </span>
      </div>
      <div className="ais-queue-card-meta">
        <span>📅 {formattedDate}</span>
        {item.instagramPageId && <span>📱 {item.instagramPageId}</span>}
        {item.errorMessage && (
          <span style={{ color: "#EF4444" }}>⚠ {item.errorMessage}</span>
        )}
      </div>
      {item.status !== "posted" && (
        <div className="ais-queue-card-actions">
          <button
            className="ais-copy-btn"
            onClick={onDelete}
            style={{ color: "#EF4444", borderColor: "rgba(239,68,68,0.2)" }}
          >
            {t("studio_queue_delete")}
          </button>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/studio/queue")({
  component: QueuePage,
});
