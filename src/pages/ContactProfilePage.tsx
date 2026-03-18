import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useUpdateContact, SALES_STAGES, ONBOARDING_STAGES, type Contact } from "@/hooks/useContacts";
import { logActivity } from "@/hooks/useActivityLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
  MapPin,
  Building,
  MessageSquare,
  ArrowRightLeft,
  Send,
  Clock,
  Zap,
  Activity,
  Loader2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

const ALL_STAGES = [
  ...SALES_STAGES.map((s) => ({ ...s, pipeline: "sales" as const })),
  ...ONBOARDING_STAGES.map((s) => ({ ...s, pipeline: "onboarding" as const })),
];

function getStageLabel(key: string, pipeline?: string) {
  const match = ALL_STAGES.find((s) => s.key === key && (!pipeline || s.pipeline === pipeline));
  return match?.label || key;
}

// --- Hooks ---

function useContact(id: string) {
  return useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Contact;
    },
  });
}

function useContactActivity(contactId: string) {
  return useQuery({
    queryKey: ["contact_activity", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

function useContactMessages(contactId: string) {
  return useQuery({
    queryKey: ["contact_messages", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_queue")
        .select("*")
        .eq("contact_id", contactId)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// --- Activity icon/color mapping ---

function getActivityIcon(type: string) {
  switch (type) {
    case "stage_changed":
      return <ArrowRightLeft className="w-4 h-4 text-primary" />;
    case "message_sent":
      return <Send className="w-4 h-4 text-primary" />;
    case "contact_created":
      return <User className="w-4 h-4 text-accent-foreground" />;
    case "marked_replied":
      return <MessageSquare className="w-4 h-4 text-primary" />;
    case "sequence_enrolled":
      return <Zap className="w-4 h-4 text-primary" />;
    default:
      return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}

// --- Main Component ---

export default function ContactProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useContact(id!);
  const { data: activities = [] } = useContactActivity(id!);
  const { data: messages = [] } = useContactMessages(id!);
  const qc = useQueryClient();

  const [smsDialogOpen, setSmsDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Contact not found.
        <Button variant="link" onClick={() => navigate(-1)} className="ml-2">Go back</Button>
      </div>
    );
  }

  const stageLabel = getStageLabel(contact.stage, contact.pipeline);
  const pipelineLabel = contact.pipeline === "onboarding" ? "Onboarding" : "Sales";

  // Merge activities and sent messages into a unified timeline
  const timeline = [
    ...activities.map((a: any) => ({
      id: a.id,
      type: a.activity_type,
      description: a.description,
      timestamp: a.created_at,
      icon: getActivityIcon(a.activity_type),
    })),
    ...messages
      .filter((m: any) => m.status === "sent")
      .map((m: any) => ({
        id: m.id,
        type: "message_sent",
        description: `${m.message_type.toUpperCase()} sent: "${m.message_content.slice(0, 80)}${m.message_content.length > 80 ? "…" : ""}"`,
        timestamp: m.sent_at || m.scheduled_at,
        icon: getActivityIcon("message_sent"),
      })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const pendingMessages = messages.filter((m: any) => m.status === "pending");

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-lg font-display font-bold text-primary">
            {contact.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-display font-bold truncate">{contact.full_name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
            <Badge variant="outline" className="border-primary/40 text-primary">
              {pipelineLabel}
            </Badge>
            <Badge variant="secondary">{stageLabel}</Badge>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setSmsDialogOpen(true)}>
            <MessageSquare className="w-4 h-4 mr-1" /> Send SMS
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info + sequences */}
        <div className="space-y-4">
          {/* Contact Info Card */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{contact.lead_source}</span>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground">
                Added {formatDistanceToNow(new Date(contact.created_at), { addSuffix: true })}
              </div>
              {contact.notes && (
                <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">{contact.notes}</p>
              )}
            </CardContent>
          </Card>

          {/* Pending Messages */}
          {pendingMessages.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" /> Pending Messages ({pendingMessages.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingMessages.slice(0, 5).map((msg: any) => (
                  <div key={msg.id} className="text-xs space-y-0.5 p-2 bg-secondary/30 rounded">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">{msg.message_type.toUpperCase()}</Badge>
                      <span className="text-muted-foreground">
                        {format(new Date(msg.scheduled_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate">{msg.message_content}</p>
                  </div>
                ))}
                {pendingMessages.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{pendingMessages.length - 5} more
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Activity Timeline */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No activity yet.
                </p>
              ) : (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-4">
                    {timeline.map((item) => (
                      <div key={item.id} className="flex gap-3 relative">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 z-10">
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <p className="text-sm">{item.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(item.timestamp), "MMM d, yyyy · h:mm a")}
                            {" · "}
                            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <SendSmsDialog
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        contact={contact}
      />
    </div>
  );
}

// --- Send SMS Dialog (copy-to-clipboard for now) ---

function SendSmsDialog({
  open,
  onOpenChange,
  contact,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contact: Contact;
}) {
  const [message, setMessage] = useState("");
  const qc = useQueryClient();

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Message is required");
      return;
    }

    // Queue the message and copy to clipboard
    const { error } = await supabase.from("message_queue").insert({
      contact_id: contact.id,
      message_content: message,
      message_type: "sms",
      scheduled_at: new Date().toISOString(),
      status: "pending",
    });

    if (error) {
      toast.error("Failed to queue message");
      return;
    }

    await navigator.clipboard.writeText(message);
    await logActivity("message_queued", `Manual SMS queued: "${message.slice(0, 60)}…"`, contact.id);
    qc.invalidateQueries({ queryKey: ["contact_messages"] });
    qc.invalidateQueries({ queryKey: ["contact_activity"] });
    toast.success("Message queued & copied to clipboard", {
      description: contact.phone ? `Send to ${contact.phone}` : "No phone number on file",
    });
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display">Send SMS to {contact.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {contact.phone && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Phone className="w-4 h-4" /> {contact.phone}
            </p>
          )}
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSend}>
              <Copy className="w-4 h-4 mr-1" /> Queue & Copy
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
