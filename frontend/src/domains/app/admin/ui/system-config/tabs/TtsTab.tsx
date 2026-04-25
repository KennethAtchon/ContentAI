import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { Input } from "@/shared/ui/primitives/input";
import { Label } from "@/shared/ui/primitives/label";
import { Badge } from "@/shared/ui/primitives/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/primitives/select";
import { cn } from "@/shared/lib/utils";
import { useSystemConfig } from "@/domains/admin/hooks/use-system-config";
import { Section } from "../components/Section";
import { TabSkeleton } from "../components/TabSkeleton";
import { ConfigNumberField } from "../components/ConfigNumberField";
import type { TtsVoice, VoiceFormState } from "../types";

const BLANK_VOICE: VoiceFormState = {
  id: "",
  name: "",
  gender: "neutral",
  description: "",
  elevenLabsId: "",
};

function VoiceFormFields({
  form,
  onChange,
}: {
  form: VoiceFormState;
  onChange: (form: VoiceFormState) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-dim-1 uppercase tracking-wider">
          ID <span className="text-red-400">*</span>
        </Label>
        <Input
          value={form.id}
          onChange={(e) => onChange({ ...form, id: e.target.value })}
          placeholder="e.g. rachel-v1"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-dim-1 uppercase tracking-wider">
          Name <span className="text-red-400">*</span>
        </Label>
        <Input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. Rachel"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-dim-1 uppercase tracking-wider">
          Gender
        </Label>
        <Select
          value={form.gender}
          onValueChange={(v) =>
            onChange({ ...form, gender: v as VoiceFormState["gender"] })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-dim-1 uppercase tracking-wider">
          ElevenLabs ID <span className="text-red-400">*</span>
        </Label>
        <Input
          value={form.elevenLabsId}
          onChange={(e) => onChange({ ...form, elevenLabsId: e.target.value })}
          placeholder="ElevenLabs voice ID"
          className="h-8 text-sm font-mono"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs font-medium text-dim-1 uppercase tracking-wider">
          Description
        </Label>
        <Input
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="Brief description of the voice style"
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}

export function TtsTab() {
  const { entries, isLoading, updateEntry } = useSystemConfig("tts");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [addingVoice, setAddingVoice] = useState(false);
  const [voiceForm, setVoiceForm] = useState<VoiceFormState>(BLANK_VOICE);
  const [savingVoices, setSavingVoices] = useState(false);

  const getNum = (key: string) =>
    entries[key]?.value != null ? Number(entries[key]!.value) : 0;

  const getVoices = (): TtsVoice[] => {
    try {
      return entries["voices"]?.value
        ? (JSON.parse(entries["voices"].value) as TtsVoice[])
        : [];
    } catch {
      return [];
    }
  };
  const voices = getVoices();

  const maskId = (id: string) =>
    id.length < 8 ? "••••••" : `${id.slice(0, 4)}••••${id.slice(-4)}`;

  const saveVoices = async (next: TtsVoice[]) => {
    setSavingVoices(true);
    try {
      await updateEntry("voices", next);
      toast.success("Voices saved");
    } catch {
      toast.error("Failed to save voices");
    } finally {
      setSavingVoices(false);
    }
  };

  const handleDelete = (idx: number) =>
    saveVoices(voices.filter((_, i) => i !== idx));

  const handleAdd = async () => {
    if (!voiceForm.id || !voiceForm.name || !voiceForm.elevenLabsId) {
      toast.error("ID, name, and ElevenLabs ID are required");
      return;
    }
    await saveVoices([...voices, { ...voiceForm }]);
    setAddingVoice(false);
    setVoiceForm(BLANK_VOICE);
  };

  const handleEditSave = async (idx: number) => {
    await saveVoices(voices.map((v, i) => (i === idx ? { ...voiceForm } : v)));
    setEditingIdx(null);
  };

  const startEdit = (idx: number, voice: TtsVoice) => {
    setVoiceForm({ ...voice });
    setEditingIdx(idx);
    setAddingVoice(false);
  };

  if (isLoading) return <TabSkeleton />;

  return (
    <div className="space-y-5">
      <Section title="Pricing">
        <ConfigNumberField
          label="Cost per 1,000 Characters"
          description="Internal cost for TTS generation tracking and analytics"
          value={getNum("cost_per_1000_chars")}
          onSave={(v) => updateEntry("cost_per_1000_chars", v)}
          prefix="$"
        />
      </Section>

      <Section
        title="Voice Library"
        description="Manage available TTS voices. ElevenLabs IDs are partially masked."
      >
        <div className="space-y-3">
          {voices.length === 0 && (
            <p className="text-sm text-dim-3 text-center py-6">
              No voices configured yet.
            </p>
          )}
          {voices.map((voice, idx) => (
            <div
              key={`${voice.id}-${idx}`}
              className="rounded-lg border border-overlay-sm bg-overlay-xs"
            >
              {editingIdx === idx ? (
                <div className="p-4 space-y-3">
                  <VoiceFormFields form={voiceForm} onChange={setVoiceForm} />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingIdx(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleEditSave(idx)}
                      disabled={savingVoices}
                    >
                      {savingVoices && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-studio-fg">
                        {voice.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs capitalize",
                          voice.gender === "female" &&
                            "bg-pink-500/10 text-pink-400 border-pink-500/20",
                          voice.gender === "male" &&
                            "bg-blue-500/10 text-blue-400 border-blue-500/20",
                          voice.gender === "neutral" &&
                            "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        )}
                      >
                        {voice.gender}
                      </Badge>
                    </div>
                    {voice.description && (
                      <p className="text-xs text-dim-3 truncate mt-0.5">
                        {voice.description}
                      </p>
                    )}
                    <p className="text-xs text-dim-3 font-mono mt-0.5">
                      {maskId(voice.elevenLabsId)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-dim-2 hover:text-studio-fg"
                      onClick={() => startEdit(idx, voice)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:bg-red-500/10"
                      onClick={() => handleDelete(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {addingVoice ? (
            <div className="rounded-lg border border-studio-accent/30 bg-studio-accent/5 p-4 space-y-3">
              <p className="text-sm font-medium text-studio-fg">
                Add New Voice
              </p>
              <VoiceFormFields form={voiceForm} onChange={setVoiceForm} />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddingVoice(false);
                    setVoiceForm(BLANK_VOICE);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAdd} disabled={savingVoices}>
                  {savingVoices ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Add Voice
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed border-overlay-md text-dim-2 hover:text-studio-fg hover:border-overlay-lg"
              onClick={() => {
                setAddingVoice(true);
                setEditingIdx(null);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Voice
            </Button>
          )}
        </div>
      </Section>
    </div>
  );
}
