import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useBusinessId } from "@/hooks/useBusinessId";

export interface DashboardStats {
  newLeadsThisWeek: number;
  unreadMessages: number;
  contactsInPipeline: number;
  reviewsCollected: number;
}

export function useDashboardStats() {
  const { data: businessId } = useBusinessId();
  return useQuery({
    queryKey: ["dashboard_stats", businessId],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [contactsRes, messagesRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("pipeline, created_at")
          .eq("business_id", businessId!),
        supabase
          .from("message_queue")
          .select("status")
          .eq("business_id", businessId!),
      ]);

      const contacts = contactsRes.data || [];
      const messages = messagesRes.data || [];

      return {
        newLeadsThisWeek: contacts.filter(
          (c) => new Date(c.created_at) >= weekAgo
        ).length,
        unreadMessages: messages.filter((m) => m.status === "pending").length,
        contactsInPipeline: contacts.filter((c) => !!c.pipeline).length,
        reviewsCollected: 0,
      } as DashboardStats;
    },
    enabled: !!businessId,
    refetchInterval: 30000,
  });
}
