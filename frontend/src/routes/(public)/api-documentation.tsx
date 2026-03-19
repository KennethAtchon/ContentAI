import { createFileRoute } from "@tanstack/react-router";
import { StudioShell } from "@/shared/components/layout/studio-shell";
import { StudioHero } from "@/shared/components/layout/studio-hero";
import { StudioSection } from "@/shared/components/custom-ui/studio-section";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Code, Lock, Zap, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface EndpointRow {
  method: string;
  path: string;
  description: string;
}

interface EndpointGroup {
  title: string;
  endpoints: EndpointRow[];
}

function ApiDocumentationPage() {
  const { t } = useTranslation();

  const endpointGroups: EndpointGroup[] = [
    {
      title: t("api_reels_title"),
      endpoints: [
        {
          method: "GET",
          path: "/api/reels/discover",
          description: t("api_endpoint_discover_desc"),
        },
        {
          method: "POST",
          path: "/api/reels/analyze",
          description: t("api_endpoint_analyze_desc"),
        },
        {
          method: "GET",
          path: "/api/reels/history",
          description: t("api_endpoint_history_desc"),
        },
        {
          method: "POST",
          path: "/api/reels/export",
          description: t("api_endpoint_export_desc"),
        },
        {
          method: "GET",
          path: "/api/reels/usage",
          description: t("api_endpoint_usage_desc"),
        },
      ],
    },
    {
      title: t("api_generation_title"),
      endpoints: [
        {
          method: "POST",
          path: "/api/generation/create",
          description: t("api_endpoint_generation_create_desc"),
        },
        {
          method: "GET",
          path: "/api/generation/history",
          description: t("api_endpoint_generation_history_desc"),
        },
        {
          method: "POST",
          path: "/api/generation/queue",
          description: t("api_endpoint_queue_add_desc"),
        },
      ],
    },
    {
      title: t("api_user_title"),
      endpoints: [
        {
          method: "GET",
          path: t("api_endpoint_profile"),
          description: t("api_endpoint_profile_desc"),
        },
        {
          method: "DELETE",
          path: t("api_endpoint_delete"),
          description: t("api_endpoint_delete_desc"),
        },
      ],
    },
    {
      title: t("api_gdpr_title"),
      endpoints: [
        {
          method: "GET",
          path: t("api_endpoint_export_data"),
          description: t("api_endpoint_export_data_desc"),
        },
        {
          method: "POST",
          path: t("api_endpoint_object"),
          description: t("api_endpoint_object_desc"),
        },
      ],
    },
  ];

  const methodColors: Record<string, string> = {
    GET: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    POST: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    DELETE: "bg-error text-error dark:bg-error/30 dark:text-error",
  };

  const errorCodes = [
    t("api_error_401"),
    t("api_error_403"),
    t("api_error_429"),
    t("api_error_500"),
  ];

  return (
    <StudioShell variant="public" showFooter>
      <StudioHero
        badge={{ icon: Code, text: t("api_documentation_badge") }}
        title={
          <>
            API
            <span className="block bg-gradient-to-r from-studio-accent to-studio-purple bg-clip-text text-transparent mt-2">
              Documentation
            </span>
          </>
        }
        description={t("api_documentation_description")}
        showGradient
      >
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-base text-dim-2">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-studio-accent" />
            <span>{t("api_authentication_title")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-studio-accent" />
            <span>{t("api_rate_limiting_title")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-studio-accent" />
            <span>REST / JSON</span>
          </div>
        </div>
      </StudioHero>

      <StudioSection maxWidth="4xl">
        <div className="space-y-8">
          <Card className="bg-overlay-xs border border-overlay-sm rounded-[14px]">
            <CardHeader>
              <CardTitle className="text-3xl flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-studio-accent/15">
                  <Code className="h-5 w-5 text-studio-accent" />
                </div>
                {t("api_base_url_title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <code className="block rounded-lg bg-muted px-4 py-3 text-base font-mono text-foreground">
                https://reelstudio.ai
              </code>
            </CardContent>
          </Card>

          {endpointGroups.map((group) => (
            <Card
              key={group.title}
              className="bg-overlay-xs border border-overlay-sm rounded-[14px]"
            >
              <CardHeader>
                <CardTitle className="text-3xl">{group.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {group.endpoints.map((ep) => (
                    <div
                      key={ep.path}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start gap-3"
                    >
                      <Badge
                        className={`shrink-0 font-mono text-sm ${methodColors[ep.method] ?? "bg-muted text-dim-2"}`}
                        variant="secondary"
                      >
                        {ep.method}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <code className="text-base font-mono text-foreground break-all">
                          {ep.path.replace(`${ep.method} `, "")}
                        </code>
                        <p className="mt-1 text-base text-dim-2">
                          {ep.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="bg-overlay-xs border border-overlay-sm rounded-[14px]">
            <CardHeader>
              <CardTitle className="text-3xl">
                {t("api_error_codes_title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-dim-2">
                {errorCodes.map((code) => (
                  <li key={code} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-studio-accent mt-0.5 shrink-0" />
                    <span>{code}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </StudioSection>
    </StudioShell>
  );
}

export const Route = createFileRoute("/(public)/api-documentation")({
  component: ApiDocumentationPage,
});
