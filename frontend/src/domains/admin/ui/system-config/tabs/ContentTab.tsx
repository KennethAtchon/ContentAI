import { useSystemConfig } from "@/domains/admin/hooks/use-system-config";
import { Section } from "../components/Section";
import { TabSkeleton } from "../components/TabSkeleton";
import { ConfigNumberField } from "../components/ConfigNumberField";

export function ContentTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("content");
  const getNum = (key: string) =>
    entries[key]?.value != null ? Number(entries[key]!.value) : 0;

  if (isLoading) return <TabSkeleton />;

  return (
    <div className="space-y-5">
      <Section
        title="Viral Thresholds"
        description="Thresholds used to classify content as viral."
      >
        <ConfigNumberField
          label="Viral Views Threshold"
          description="Minimum view count for a reel to be classified as viral"
          value={getNum("viral_views_threshold")}
          onSave={(v) => updateEntry("viral_views_threshold", v)}
          min={0}
          suffix="views"
        />
      </Section>
    </div>
  );
}
