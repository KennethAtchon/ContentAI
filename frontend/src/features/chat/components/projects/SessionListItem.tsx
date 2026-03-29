import { Button } from "@/shared/components/ui/button";
import { Check, Edit3, MessageSquare, Trash2, X } from "lucide-react";
import type { ChatSession } from "../../types/chat.types";

interface SessionListItemProps {
  session: ChatSession;
  selectedSessionId?: string;
  editingSessionId: string | null;
  editingSessionTitle: string;
  setEditingSessionTitle: (value: string) => void;
  onSessionSelect: (session: ChatSession) => void;
  onStartEditingSession: (session: ChatSession) => void;
  onCancelEditingSession: () => void;
  onSaveSessionTitle: () => void;
  onDeleteSessionRequest: (sessionId: string) => void;
  t: (key: string) => string;
}

export function SessionListItem({
  session,
  selectedSessionId,
  editingSessionId,
  editingSessionTitle,
  setEditingSessionTitle,
  onSessionSelect,
  onStartEditingSession,
  onCancelEditingSession,
  onSaveSessionTitle,
  onDeleteSessionRequest,
  t,
}: SessionListItemProps) {
  return (
    <div
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        selectedSessionId === session.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
      }`}
      onClick={() => onSessionSelect(session)}
    >
      <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
      {editingSessionId === session.id ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            type="text"
            value={editingSessionTitle}
            onChange={(e) => setEditingSessionTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSaveSessionTitle();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancelEditingSession();
              }
            }}
            className="flex-1 text-sm bg-transparent border-b border-primary outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-4 w-4 p-0 hover:text-primary shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onSaveSessionTitle();
            }}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-4 w-4 p-0 hover:text-muted-foreground shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onCancelEditingSession();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm truncate">{session.title}</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-4 w-4 p-0"
              aria-label={t("studio_chat_renameSession")}
              onClick={(e) => {
                e.stopPropagation();
                onStartEditingSession(session);
              }}
            >
              <Edit3 className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-4 w-4 p-0 hover:text-destructive"
              aria-label={t("studio_chat_deleteSession")}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSessionRequest(session.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

