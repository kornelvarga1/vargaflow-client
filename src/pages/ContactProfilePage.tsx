import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useUpdateContact, type Contact } from "@/hooks/useContacts";
import { logActivity } from "@/hooks/useActivityLog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Phone,
  User,
  MessageSquare,
  ArrowRightLeft,
  Send,
  Zap,
  Activity,
  Loader2,
  Copy,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import ContactFormDialog from "@/components/contacts/ContactFormDialog";
import { invokeFunction } from "@/lib/invokeFunction";
import { normalizePhone } from "@/lib/utils";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { getInitials, getAvatarTone } from "@/lib/initials";

function formatActivityTime(iso: string): { display: string; full: string } {
  const date = new Date(iso);
  const ageDays = (Date.now() - date.getTime()) / 86_400_000;
  const display =
    ageDays < 7
      ? formatDistanceToNow(date, { addSuffix: true })
      : format(date, "MMM d");
  const full = format(date, "MMM d, yyyy · h:mm a");
  return { display, full };
}

// --- Hooks ---

function useContact(id: string, businessId: string | undefined) {
  return useQuery({
    queryKey: ["contact", id, businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id)
        .eq("business_id", businessId!)
        .single();
      if (error) throw error;
      return data as Contact;
    },
  });
}

function useContactActivity(contactId: string, businessId: string | undefined) {
  return useQuery({
    queryKey: ["contact_activity", contactId, businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("contact_id", contactId)
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

function useContactMessages(contactId: string, businessId: string | undefined) {
  return useQuery({
    queryKey: ["contact_messages", contactId, businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_queue")
        .select("*")
        .eq("contact_id", contactId)
        .eq("business_id", businessId!)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// --- Activity icon/color mapping ---

function getActivityIcon(type: string) {
  const cls = "w-4 h-4 text-muted-foreground";
  switch (type) {
    case "stage_changed":
      return <ArrowRightLeft className={cls} strokeWidth={1.5} />;
    case "message_sent":
      return <Send className={cls} strokeWidth={1.5} />;
    case "contact_created":
      return <User className={cls} strokeWidth={1.5} />;
    case "marked_replied":
      return <MessageSquare className={cls} strokeWidth={1.5} />;
    case "sequence_enrolled":
      return <Zap className={cls} strokeWidth={1.5} />;
    default:
      return <Activity className={cls} strokeWidth={1.5} />;
  }
}

// --- Main Component ---

export function ContactProfileBody({ id, businessId, showBackButton = true }: { id: string; businessId: string | undefined; showBackButton?: boolean }) {
  const navigate = useNavigate();
  const { data: contact, isLoading } = useContact(id, businessId);
  const { data: activities = [] } = useContactActivity(id, businessId);
  const { data: messages = [] } = useContactMessages(id, businessId);
  const qc = useQueryClient();

  const updateContact = useUpdateContact();

  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [jobCompleteOpen, setJobCompleteOpen] = useState(false);

  function handleJobCompleteClick() {
    if (!contact) return;
    const firstName = contact.full_name.trim().split(/\s+/)[0] || "";
    if (!firstName || /^[+\d]/.test(firstName)) {
      toast.error("Add the customer's name before enrolling.", { description: "Tap the edit button to add it." });
      return;
    }
    const digits = normalizePhone(contact.phone || "");
    if (!digits || digits.length !== 10) {
      toast.error("Can't submit — contact needs a valid 10-digit phone number.");
      return;
    }
    setJobCompleteOpen(true);
  }
  const [notesValue, setNotesValue] = useState("");
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const resizeNotes = useCallback(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    setNotesValue(contact?.notes || "");
  }, [contact?.id]);

  useEffect(() => {
    resizeNotes();
  }, [notesValue, resizeNotes]);

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

  const heroName = contact.full_name.trim();
  const heroIsPhone = !heroName || /^[+\d]/.test(heroName);
  const heroMeta: string[] = [];
  if (contact.phone) heroMeta.push(contact.phone);
  if (contact.email) heroMeta.push(contact.email);
  if (contact.lead_source) heroMeta.push(contact.lead_source);

  return (
    <div className="px-4 md:px-6 pt-4 max-w-2xl mx-auto animate-fade-in">
      {/* Top action row */}
      <div className="flex items-center justify-between -mx-1">
        {showBackButton ? (
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </Button>
        ) : <div />}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4" strokeWidth={1.5} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            title="Job Complete"
            onClick={handleJobCompleteClick}
          >
            <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
          </Button>
          {showBackButton && (
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => navigate("/messages", { state: { contactId: contact.id } })}>
              <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
            </Button>
          )}
        </div>
      </div>

      {/* Hero — avatar + serif name + muted metadata */}
      <header className="px-1 pt-6 pb-8">
        <div className={`w-20 h-20 rounded-full ${heroIsPhone ? "bg-secondary" : getAvatarTone(heroName)} flex items-center justify-center mb-5`}>
          {heroIsPhone ? (
            <Phone className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
          ) : (
            <span className="text-2xl font-medium text-white/95">
              {getInitials(heroName)}
            </span>
          )}
        </div>
        <h1 className="font-serif text-3xl text-foreground leading-tight">{contact.full_name}</h1>
        {heroMeta.length > 0 && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {heroMeta.join(" · ")}
          </p>
        )}
        <p
          className="text-xs text-muted-foreground/80 mt-1.5"
          title={format(new Date(contact.created_at), "MMM d, yyyy · h:mm a")}
        >
          Added {formatDistanceToNow(new Date(contact.created_at), { addSuffix: true })}
        </p>
      </header>

      {/* Notes — inline editable */}
      <div className="w-full bg-card border border-border/60 rounded-2xl p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-2">Notes</p>
        <Textarea
          ref={notesRef}
          value={notesValue}
          onChange={(e) => { setNotesValue(e.target.value); resizeNotes(); }}
          onBlur={async () => {
            const trimmed = notesValue.trim();
            const original = contact.notes?.trim() || "";
            if (trimmed !== original) {
              await updateContact.mutateAsync({ id: contact.id, notes: trimmed || null });
              qc.invalidateQueries({ queryKey: ["contact", id] });
            }
          }}
          placeholder="Add a note…"
          className="text-sm resize-none border-0 p-0 bg-transparent shadow-none min-h-[60px] overflow-hidden placeholder:text-muted-foreground"
        />
      </div>

      {/* Pending Messages */}
      {pendingMessages.length > 0 && (
        <div className="bg-card border border-border/60 rounded-2xl p-4 mt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-3">
            Pending ({pendingMessages.length})
          </p>
          <div className="space-y-2">
            {pendingMessages.slice(0, 5).map((msg: any) => (
              <div key={msg.id} className="text-xs space-y-1 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px] border-border/60 text-muted-foreground font-normal">
                    {msg.message_type.toUpperCase()}
                  </Badge>
                  <span className="text-muted-foreground">
                    {format(new Date(msg.scheduled_at), "MMM d, h:mm a")}
                  </span>
                </div>
                <p className="text-muted-foreground truncate">{msg.message_content}</p>
              </div>
            ))}
            {pendingMessages.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{pendingMessages.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <section className="mt-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground px-1 mb-4">
          Activity
        </p>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No activity yet.
          </p>
        ) : (
          <div className="relative pl-1">
            {/* Hairline rail */}
            <div className="absolute left-[10px] top-1.5 bottom-1.5 w-px bg-border/60" />
            <ul className="space-y-2">
              {timeline.map((item) => {
                const t = formatActivityTime(item.timestamp);
                return (
                  <li key={item.id} className="flex gap-3 relative">
                    <div className="w-5 h-5 flex items-center justify-center shrink-0 z-10 bg-background mt-0.5">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0 pb-1.5">
                      <p className="text-sm text-foreground/90">{item.description}</p>
                      <p
                        className="text-xs text-muted-foreground mt-0.5"
                        title={t.full}
                      >
                        {t.display}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <div className="h-12" />

      {/* Dialogs */}
      <ContactFormDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) qc.invalidateQueries({ queryKey: ["contact"] });
        }}
        contact={contact}
      />
      <SendSmsDialog
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        contact={contact}
      />
      <JobCompleteDialog
        open={jobCompleteOpen}
        onOpenChange={setJobCompleteOpen}
        contact={contact}
        businessId={businessId}
      />
    </div>
  );
}

export default function ContactProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: businessId } = useBusinessId();
  return <ContactProfileBody id={id!} businessId={businessId} showBackButton={true} />;
}

// --- Job Complete Confirmation Dialog ---

function JobCompleteDialog({
  open,
  onOpenChange,
  contact,
  businessId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contact: Contact;
  businessId: string | undefined;
}) {
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    if (open) {
      setFirstName(contact.full_name.trim().split(/\s+/)[0] || "");
      setPhone(contact.phone || "");
      setFirstNameError("");
      setPhoneError("");
    }
  }, [open, contact]);

  async function handleConfirm() {
    let ok = true;
    if (!firstName.trim() || /^[+\d]/.test(firstName.trim())) {
      setFirstNameError("Enter the customer's first name.");
      ok = false;
    } else {
      setFirstNameError("");
    }
    const digits = normalizePhone(phone);
    if (!digits || digits.length !== 10) {
      setPhoneError("Enter a valid 10-digit phone number.");
      ok = false;
    } else {
      setPhoneError("");
    }
    if (!ok) return;

    setLoading(true);
    const { error } = await invokeFunction("one-year-followup-entry", {
      business_id: businessId,
      contact_first_name: firstName.trim(),
      contact_phone: normalizePhone(phone),
    });
    setLoading(false);
    if (error) {
      toast.error("Something went wrong — try again.");
    } else {
      toast.success(`${firstName.trim()} added to review + follow-up sequence.`);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add to Job Complete?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Customer First Name</Label>
              <Input
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); if (firstNameError) setFirstNameError(""); }}
                placeholder="e.g. John"
                className={firstNameError ? "border-destructive" : ""}
              />
              {firstNameError && <p className="text-xs text-destructive">{firstNameError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Phone</Label>
              <Input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(""); }}
                placeholder="e.g. 8085551234"
                className={phoneError ? "border-destructive" : ""}
              />
              {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
            </div>
          </div>
          <div className="border-l-2 border-primary pl-3 space-y-1.5 text-sm">
            <p className="font-medium text-foreground">1. ⭐ 4-week review request funnel</p>
            <p className="text-muted-foreground italic text-xs">(*stops automatically if they leave a review*)</p>
            <p className="font-medium text-foreground pt-1">2. 🗓️ 1-year follow-up sequence</p>
            <p className="text-muted-foreground text-xs">Texted every 2–3 months for return discounts + referrals</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? "Adding…" : "Add to Job Complete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
      to_phone: contact.phone || null,
      business_id: contact.business_id,
      metadata: { to: contact.phone || null },
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
          <DialogTitle>Send SMS to {contact.full_name}</DialogTitle>
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
