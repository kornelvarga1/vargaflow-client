import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface DashboardStats {
  newLeadsThisWeek: number;
  unreadMessages: number;
  contactsInPipeline: number;
  reviewsCollected: number;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard_stats"],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [contactsRes, messagesRes] = await Promise.all([
        supabase.from("contacts").select("pipeline, created_at"),
        supabase.from("message_queue").select("status"),
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
    refetchInterval: 30000,
  });
}
