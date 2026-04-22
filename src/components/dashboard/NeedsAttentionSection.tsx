import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useBusinessId } from "@/hooks/useBusinessId";
import {
  Flame,
  UserX,
  Clock,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { differenceInDays, formatDistanceToNow } from "date-fns";

interface AttentionItem {
  id: string;
  contactId: string;
  contactName: string;
  type: "no_show" | "stale" | "failed_automation" | "replied";
  description: string;
  timestamp?: string;
}

function useNeedsAttention() {
  const { data: businessId } = useBusinessId();
  return useQuery({
    queryKey: ["needs_attention", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const items: AttentionItem[] = [];

      const [contactsRes, failedSeqRes, repliedRes] = await Promise.all([
        supabase.from("contacts").select("id, full_name, stage, pipeline, stage_entered_at").eq("business_id", businessId!),
        supabase
          .from("contact_sequences")
          .select("id, contact_id, status, updated_at, contacts(full_name), sequences(name)")
          .eq("status", "failed")
          .eq("business_id", businessId!),
        supabase
          .from("activity_log")
          .select("id, contact_id, description, created_at, contacts(full_name)")
          .eq("activity_type", "marked_replied")
          .eq("business_id", businessId!)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const contacts = contactsRes.data || [];
      const now = new Date();

      const noShowed = contacts.filter((c) => c.stage === "No Showed to Zoom");
      for (const c of noShowed) {
        items.push({
          id: `noshow-${c.id}`,
          contactId: c.id,
          contactName: c.full_name,
          type: "no_show",
          description: `No-showed Zoom — ${c.stage_entered_at ? formatDistanceToNow(new Date(c.stage_entered_at), { addSuffix: true }) : "unknown time"}`,
          timestamp: c.stage_entered_at,
        });
      }

      for (const c of contacts) {
        if (!c.stage_entered_at) continue;
        const days = differenceInDays(now, new Date(c.stage_entered_at));
        if (days >= 5) {
          const terminalStages = ["Client Closed", "Client Churned", "Approved Retainer"];
          if (terminalStages.includes(c.stage)) continue;
          if (c.stage === "No Showed to Zoom") continue;

          items.push({
            id: `stale-${c.id}`,
            contactId: c.id,
            contactName: c.full_name,
            type: "stale",
            description: `No activity for ${days} days`,
            timestamp: c.stage_entered_at,
          });
        }
      }

      const failedSeqs = failedSeqRes.data || [];
      for (const seq of failedSeqs) {
        const name = (seq as any).contacts?.full_name || "Unknown";
        const seqName = (seq as any).sequences?.name || "Unknown sequence";
        items.push({
          id: `failed-${seq.id}`,
          contactId: seq.contact_id,
          contactName: name,
          type: "failed_automation",
          description: `Automation "${seqName}" failed`,
          timestamp: seq.updated_at,
        });
      }

      const replies = repliedRes.data || [];
      for (const r of replies) {
        const name = (r as any).contacts?.full_name || "Unknown";
        items.push({
          id: `replied-${r.id}`,
          contactId: r.contact_id || "",
          contactName: name,
          type: "replied",
          description: `Replied — needs follow-up`,
          timestamp: r.created_at,
        });
      }

      items.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      return items;
    },
    refetchInterval: 30000,
  });
}

const typeIcons: Record<string, typeof Flame> = {
  no_show: UserX,
  stale: Clock,
  failed_automation: AlertTriangle,
  replied: Zap,
};

export default function NeedsAttentionSection() {
  const { data: items = [], isLoading } = useNeedsAttention();
  const [expanded, setExpanded] = useState(false);

  if (isLoading || items.length === 0) return null;

  return (
    <div className="rounded-2xl bg-secondary/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/60 transition-colors active-press"
      >
        <Flame className="w-4 h-4 text-primary shrink-0" strokeWidth={1.5} />
        <span className="text-sm text-foreground/90 flex-1">
          {items.length} contact{items.length === 1 ? "" : "s"} need follow-up
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          strokeWidth={1.5}
        />
      </button>
      {expanded && (
        <ul className="divide-y divide-border/40 border-t border-border/40">
          {items.map((item) => {
            const Icon = typeIcons[item.type] || Clock;
            const row = (
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.contactName}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />
              </div>
            );
            return (
              <li key={item.id}>
                {item.contactId ? (
                  <Link to={`/contacts/${item.contactId}`}>{row}</Link>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
