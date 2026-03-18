import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useBusinessId() {
  return useQuery({
    queryKey: ["business_id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data.business_id as string;
    },
    staleTime: Infinity, // business_id never changes within a session
  });
}
