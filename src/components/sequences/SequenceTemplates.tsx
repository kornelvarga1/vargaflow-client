import { useState } from "react";
import { useSequences, useSequenceSteps, useUpdateSequence, useUpdateStep } from "@/hooks/useSequences";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, ChevronRight, MessageSquare, Mail } from "lucide-react";
import { toast } from "sonner";

function StepCard({ step }: { step: any }) {
  const [template, setTemplate] = useState(step.message_template);
  const updateStep = useUpdateStep();
  const dirty = template !== step.message_template;

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Step {step.step_order}</span>
        <Badge variant={step.message_type === "sms" ? "default" : "secondary"}>
          {step.message_type === "sms" ? (
            <><MessageSquare className="w-3 h-3 mr-1" /> SMS</>
          ) : (
            <><Mail className="w-3 h-3 mr-1" /> Email</>
          )}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Delay: {step.delay_hours}h {step.delay_minutes}m
        </span>
      </div>
      <Textarea
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        rows={3}
        className="text-sm"
      />
      {dirty && (
        <Button
          size="sm"
          onClick={() => {
            updateStep.mutate(
              { id: step.id, sequence_id: step.sequence_id, message_template: template },
              {
                onSuccess: () => toast.success("Step saved"),
                onError: () => toast.error("Failed to save step"),
              }
            );
          }}
          disabled={updateStep.isPending}
        >
          <Save className="w-3.5 h-3.5 mr-1" />
          Save
        </Button>
      )}
    </div>
  );
}

function SequenceDetail({ sequenceId }: { sequenceId: string }) {
  const { data: steps = [], isLoading } = useSequenceSteps(sequenceId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (steps.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No steps configured for this sequence.</p>;
  }

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      {steps.map((step) => (
        <StepCard key={step.id} step={step} />
      ))}
    </div>
  );
}

export default function SequenceTemplates() {
  const { data: sequences = [], isLoading } = useSequences();
  const updateSequence = useUpdateSequence();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sequences.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No sequence templates found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sequences.map((seq) => (
        <Card
          key={seq.id}
          className={`bg-card border-border cursor-pointer transition-colors hover:border-primary/40 ${selectedId === seq.id ? "border-primary" : ""}`}
          onClick={() => setSelectedId(selectedId === seq.id ? null : seq.id)}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <ChevronRight
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${selectedId === seq.id ? "rotate-90" : ""}`}
                />
                <span className="font-medium truncate">{seq.name}</span>
                <Badge variant="secondary">{seq.pipeline}</Badge>
                <span className="text-sm text-muted-foreground hidden sm:inline">{seq.stage}</span>
              </div>
              <div
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
              >
                <Switch
                  checked={seq.is_active}
                  onCheckedChange={(checked) => {
                    updateSequence.mutate(
                      { id: seq.id, is_active: checked },
                      {
                        onSuccess: () => toast.success(checked ? "Sequence activated" : "Sequence deactivated"),
                        onError: () => toast.error("Failed to update sequence"),
                      }
                    );
                  }}
                />
              </div>
            </div>
            {selectedId === seq.id && <SequenceDetail sequenceId={seq.id} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
