import { useTranslation } from "react-i18next";

export function RenderPanelPlaceholder() {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-border/60 p-3">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">
        {t("phase5_editor_render")}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("phase5_editor_render_placeholder")}
      </p>
    </section>
  );
}
