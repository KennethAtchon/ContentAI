import { Badge } from "@/shared/ui/primitives/badge";
import { useSystemConfig } from "@/domains/admin/hooks/use-system-config";
import { Section } from "../components/Section";
import { TabSkeleton } from "../components/TabSkeleton";
import { ConfigNumberField } from "../components/ConfigNumberField";

export function SubscriptionTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("subscription");

  const getNum = (key: string) =>
    entries[key]?.value != null ? Number(entries[key]!.value) : 0;

  if (isLoading) return <TabSkeleton />;

  return (
    <div className="space-y-5">
      <Section title="Trial Period">
        <ConfigNumberField
          label="Trial Days"
          description="Number of free trial days for new subscriptions"
          value={getNum("trial_days")}
          onSave={(v) => updateEntry("trial_days", v)}
          min={0}
          max={365}
          suffix="days"
        />
      </Section>

      <Section
        title="Free Tier"
        description="Limits for users without an active subscription"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ConfigNumberField
            label="Generations / Month"
            value={getNum("free_generations_per_month")}
            onSave={(v) => updateEntry("free_generations_per_month", v)}
            min={0}
          />
          <ConfigNumberField
            label="Analyses / Month"
            value={getNum("free_analyses_per_month")}
            onSave={(v) => updateEntry("free_analyses_per_month", v)}
            min={0}
          />
        </div>
      </Section>

      <Section title="Creator Tier">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ConfigNumberField
            label="Max Reels / Month"
            value={getNum("basic_max_reels_per_month")}
            onSave={(v) => updateEntry("basic_max_reels_per_month", v)}
            min={0}
          />
          <ConfigNumberField
            label="Generations / Month"
            value={getNum("basic_generations_per_month")}
            onSave={(v) => updateEntry("basic_generations_per_month", v)}
            min={0}
          />
          <ConfigNumberField
            label="Analyses / Month"
            value={getNum("basic_analyses_per_month")}
            onSave={(v) => updateEntry("basic_analyses_per_month", v)}
            min={0}
          />
          <ConfigNumberField
            label="Max Queue Items"
            value={getNum("basic_max_queue_items")}
            onSave={(v) => updateEntry("basic_max_queue_items", v)}
            min={0}
          />
        </div>
      </Section>

      <Section title="Pro Tier">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ConfigNumberField
            label="Generations / Month"
            description="-1 = unlimited"
            value={getNum("pro_generations_per_month")}
            onSave={(v) => updateEntry("pro_generations_per_month", v)}
            min={-1}
          />
          <ConfigNumberField
            label="Analyses / Month"
            description="-1 = unlimited"
            value={getNum("pro_analyses_per_month")}
            onSave={(v) => updateEntry("pro_analyses_per_month", v)}
            min={-1}
          />
          <ConfigNumberField
            label="Max Queue Items"
            description="-1 = unlimited"
            value={getNum("pro_max_queue_items")}
            onSave={(v) => updateEntry("pro_max_queue_items", v)}
            min={-1}
          />
        </div>
      </Section>

      <Section
        title="Agency (Enterprise) Tier"
        description="All limits are -1 (unlimited) by design."
      >
        <div className="flex flex-wrap gap-2">
          {["Generations", "Analyses", "Queue Items", "Reels"].map((name) => (
            <div
              key={name}
              className="flex items-center gap-2 rounded-lg border border-overlay-sm bg-overlay-xs px-3 py-2"
            >
              <span className="text-sm text-studio-fg">{name}</span>
              <Badge
                variant="secondary"
                className="text-xs bg-studio-accent/10 text-studio-accent border-studio-accent/20"
              >
                Unlimited
              </Badge>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
