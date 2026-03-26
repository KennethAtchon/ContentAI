import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ExternalLink, Loader2 } from "lucide-react";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";

interface OpenChatButtonProps {
  sessionId: string | null;
  projectId: string | null;
  generatedContentId: number | null;
  className?: string;
}

export function OpenChatButton({
  sessionId,
  projectId,
  generatedContentId,
  className,
}: OpenChatButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const [isResolving, setIsResolving] = useState(false);

  const handleClick = async () => {
    if (sessionId && projectId) {
      void navigate({
        to: "/studio/generate",
        search: { sessionId, projectId, reelId: undefined },
      });
      return;
    }

    if (!generatedContentId) return;

    setIsResolving(true);
    try {
      const result = await authenticatedFetchJson<{
        sessionId: string;
        projectId: string;
      }>("/api/chat/sessions/resolve-for-content", {
        method: "POST",
        body: JSON.stringify({ generatedContentId }),
      });
      void navigate({
        to: "/studio/generate",
        search: { sessionId: result.sessionId, projectId: result.projectId, reelId: undefined },
      });
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <button
      onClick={() => void handleClick()}
      disabled={isResolving || generatedContentId == null}
      className={className}
    >
      {isResolving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ExternalLink className="h-3.5 w-3.5" />
      )}
      {t("studio_queue_detail_open_chat")}
    </button>
  );
}
