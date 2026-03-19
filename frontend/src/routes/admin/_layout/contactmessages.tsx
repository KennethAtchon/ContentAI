import React, { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  MoreHorizontal,
  Mail,
  Loader2,
  AlertCircle,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { useApp } from "@/shared/contexts/app-context";

export const Route = createFileRoute("/admin/_layout/contactmessages")({
  component: ContactMessagesPage,
});

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

function ContactMessagesPage() {
  const { t } = useTranslation();
  const { user } = useApp();
  const fetcher = useQueryFetcher<ContactMessagesResponse>();
  const [currentPage, setCurrentPage] = useState(1);
  const adminTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const url = useMemo(() => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: PAGE_LIMIT.toString(),
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

  const messages = useMemo(() => data?.messages || [], [data?.messages]);
  const pagination = useMemo(() => {
    const p = data?.pagination;
    if (!p)
      return {
        page: currentPage,
        limit: PAGE_LIMIT,
        total: 0,
        totalPages: 1,
        hasMore: false,
        hasPrevious: currentPage > 1,
      };
    return {
      ...p,
      hasMore: p.hasMore ?? p.page < p.totalPages,
      hasPrevious: p.hasPrevious ?? p.page > 1,
    };
  }, [data?.pagination, currentPage]);

  const formattedMessages = useMemo(
    () =>
      messages.map((msg) => ({
        ...msg,
        formattedDate: new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: adminTimezone,
          timeZoneName: "short",
        }).format(new Date(msg.createdAt)),
      })),
    [messages, adminTimezone]
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold">
          {t("admin_contact_messages_all_messages")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("admin_contact_messages_count", {
            count: pagination.total,
            message:
              pagination.total === 1
                ? t("admin_contact_messages_message_singular")
                : t("admin_contact_messages_message_plural"),
          })}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">
              {t("common_loading_contact_messages")}
            </p>
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">
                {error instanceof Error
                  ? error.message
                  : t("admin_failed_to_fetch_contact_messages")}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl">
                  {t("admin_contact_messages_all_messages")}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t("admin_contact_messages_count", {
                    count: pagination.total,
                    message:
                      pagination.total === 1
                        ? t("admin_contact_messages_message_singular")
                        : t("admin_contact_messages_message_plural"),
                  })}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-base">
                <Mail className="h-3 w-3 mr-1" />
                {pagination.total} {t("admin_contact_messages_total")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">
                      {t("admin_contact_messages_name")}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {t("admin_settings_placeholder_email")}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {t("admin_contact_messages_phone")}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {t("admin_contact_messages_subject")}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {t("admin_contact_messages_message")}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {t("admin_contact_messages_received_at")}
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formattedMessages.length > 0 ? (
                    formattedMessages.map((msg) => (
                      <ContactMessageRow key={msg.id} message={msg} />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <MessageSquare className="h-8 w-8 text-muted-foreground" />
                          <p className="text-muted-foreground">
                            {t("admin_contact_messages_no_messages")}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <div className="text-base text-muted-foreground">
                  {t("common_pagination_showing", {
                    page: pagination.page,
                    totalPages: pagination.totalPages,
                    total: pagination.total,
                    item: t("common_pagination_messages"),
                  })}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => p - 1)}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t("common_pagination_previous")}
                  </Button>
                  <div className="flex items-center space-x-1">
                    {Array.from(
                      { length: Math.min(5, pagination.totalPages) },
                      (_, i) => {
                        const startPage = Math.max(1, pagination.page - 2);
                        const page = startPage + i;
                        if (page <= pagination.totalPages) {
                          return (
                            <Button
                              key={page}
                              variant={
                                pagination.page === page ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className="w-8 h-8 p-0"
                            >
                              {page}
                            </Button>
                          );
                        }
                        return null;
                      }
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={!pagination.hasMore}
                  >
                    {t("common_pagination_next")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const ContactMessageRow = React.memo(function ContactMessageRow({
  message,
}: {
  message: ContactMessage & { formattedDate: string };
}) {
  const { t } = useTranslation();

  return (
    <TableRow className="hover:bg-muted/50 transition-colors">
      <TableCell className="font-medium">{message.name}</TableCell>
      <TableCell>
        <a
          href={`mailto:${message.email}`}
          className="text-primary hover:underline"
        >
          {message.email}
        </a>
      </TableCell>
      <TableCell>
        {message.phone || <span className="text-muted-foreground">-</span>}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {message.subject}
        </Badge>
      </TableCell>
      <TableCell className="max-w-md">
        <p className="text-base line-clamp-2">{message.message}</p>
      </TableCell>
      <TableCell className="text-base text-muted-foreground">
        {message.formattedDate}
      </TableCell>
      <TableCell>
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
      </TableCell>
    </TableRow>
  );
});
