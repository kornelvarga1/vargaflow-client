import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useBusinessId } from "@/hooks/useBusinessId";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";

export type ActivityLog = Tables<"activity_log"> & {
  contacts?: { full_name: string } | null;
};

export function useActivityLog(limit = 20) {
  const { data: businessId } = useBusinessId();
  return useQuery({
    queryKey: ["activity_log", limit, businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*, contacts(full_name)")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as ActivityLog[];
    },
    enabled: !!businessId,
  });
}

export async function logActivity(
  activityType: string,
  description: string,
  contactId?: string,
  metadata?: Record<string, unknown>
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user.id)
    .single();

  const row: TablesInsert<"activity_log"> = {
    activity_type: activityType,
    description,
    contact_id: contactId || null,
    business_id: profile?.business_id ?? null,
    metadata: (metadata || {}) as Json,
  };
  const { error } = await supabase.from("activity_log").insert([row]);
  if (error) console.error("Failed to log activity:", error);
}
