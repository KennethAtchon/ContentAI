import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Mail, MoreHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/primitives/badge";
import { Button } from "@/shared/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/primitives/dropdown-menu";
import { DataTable, type ColumnDef } from "@/shared/ui/data-display/DataTable";
import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import { queryKeys } from "@/app/query/query-keys";
import { useAuth } from "@/app/state/auth-context";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  createdAt: string;
}

interface ContactMessagesResponse {
  messages: ContactMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    hasPrevious: boolean;
  };
}

const PAGE_LIMIT = 20;

const ADMIN_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ADMIN_TZ,
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function ContactMessagesView() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fetcher = useQueryFetcher<ContactMessagesResponse>();
  const [currentPage, setCurrentPage] = useState(1);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(PAGE_LIMIT),
    });
    return `/api/shared/contact-messages?${params}`;
  }, [currentPage]);

  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.api.admin.contactMessages({
      page: currentPage,
      limit: PAGE_LIMIT,
    }),
    queryFn: () => fetcher(url),
    enabled: !!user,
  });

  const pagination = data?.pagination
    ? {
        page: data.pagination.page,
        totalPages: data.pagination.totalPages,
        total: data.pagination.total,
        hasMore:
          data.pagination.hasMore ??
          data.pagination.page < data.pagination.totalPages,
      }
    : undefined;

  const columns: ColumnDef<ContactMessage>[] = [
    {
      key: "name",
      header: t("admin_contact_messages_name"),
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "email",
      header: t("admin_settings_placeholder_email"),
      cell: (row) => (
        <a
          href={`mailto:${row.email}`}
          className="text-primary hover:underline"
        >
          {row.email}
        </a>
      ),
    },
    {
      key: "phone",
      header: t("admin_contact_messages_phone"),
      cell: (row) =>
        row.phone ?? <span className="text-muted-foreground">-</span>,
    },
    {
      key: "subject",
      header: t("admin_contact_messages_subject"),
      cell: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.subject}
        </Badge>
      ),
    },
    {
      key: "message",
      header: t("admin_contact_messages_message"),
      className: "max-w-md",
      cell: (row) => <p className="text-sm line-clamp-2">{row.message}</p>,
    },
    {
      key: "createdAt",
      header: t("admin_contact_messages_received_at"),
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-[50px]",
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">
                {t("admin_contact_messages_actions")}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {t("admin_contact_messages_actions")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-muted-foreground">
              {t("admin_contact_messages_no_actions_available")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {t("admin_contact_messages_all_messages")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("admin_contact_messages_count", {
              count: pagination?.total ?? 0,
              message:
                (pagination?.total ?? 0) === 1
                  ? t("admin_contact_messages_message_singular")
                  : t("admin_contact_messages_message_plural"),
            })}
          </p>
        </div>
        <Badge variant="secondary" className="text-base">
          <Mail className="h-3 w-3 mr-1" />
          {pagination?.total ?? 0} {t("admin_contact_messages_total")}
        </Badge>
      </div>

      <DataTable
        columns={columns}
        data={data?.messages ?? []}
        isLoading={isLoading}
        error={error?.message}
        pagination={pagination}
        onPageChange={setCurrentPage}
        emptyIcon={Mail}
        emptyMessage={t("admin_contact_messages_no_messages")}
        paginationLabels={{
          previous: t("common_pagination_previous"),
          next: t("common_pagination_next"),
          showing: pagination
            ? t("common_pagination_showing", {
                page: pagination.page,
                totalPages: pagination.totalPages,
                total: pagination.total,
                item: t("common_pagination_messages"),
              })
            : undefined,
        }}
      />
    </div>
  );
}
