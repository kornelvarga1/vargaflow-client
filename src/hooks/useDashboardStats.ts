import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useBusinessId } from "@/hooks/useBusinessId";

export interface DashboardStats {
  newLeadsThisWeek: number;
  unreadMessages: number;
  messagesSentThisWeek: number;
}

export function useDashboardStats() {
  const { data: businessId } = useBusinessId();
  return useQuery({
    queryKey: ["dashboard_stats", businessId],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [contactsRes, inboundRes, sentRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("created_at")
          .eq("business_id", businessId!)
          .gte("created_at", weekAgo.toISOString()),
        supabase
          .from("message_queue")
          .select("contact_id, created_at, contacts!inner(last_read_at)")
          .eq("business_id", businessId!)
          .eq("direction", "inbound")
          .eq("status", "received"),
        supabase
          .from("message_queue")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId!)
          .eq("status", "sent")
          .gte("sent_at", weekAgo.toISOString())
          .not("message_type", "in", '("internal_sms","function_call")'),
      ]);

      // Count contacts with unread messages (matching inbox logic)
      const inbound = inboundRes.data || [];
      const unreadContacts = new Set<string>();
      for (const msg of inbound) {
        const lastRead = (msg.contacts as any)?.last_read_at;
        if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
          if (msg.contact_id) unreadContacts.add(msg.contact_id);
        }
      }

      return {
        newLeadsThisWeek: contactsRes.data?.length ?? 0,
        unreadMessages: unreadContacts.size,
        messagesSentThisWeek: sentRes.count ?? 0,
      } as DashboardStats;
    },
    enabled: !!businessId,
    refetchInterval: 30000,
  });
}
