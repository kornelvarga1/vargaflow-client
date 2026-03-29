import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useBusinessId } from "@/hooks/useBusinessId";

export type BusinessSettings = {
  my_name: string;
  my_phone: string;
  my_email: string;
  company_name: string;
  gmb_review_link: string;
  quote_form_link: string;
  marketing_form_link: string;
};

export function useBusinessSettings() {
  const { data: businessId } = useBusinessId();
  return useQuery({
    queryKey: ["business_settings", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("my_name, my_phone, my_email, company_name, gmb_review_link, quote_form_link, marketing_form_link")
        .eq("business_id", businessId!)
        .single();
      if (error) throw error;
      return data as BusinessSettings;
    },
  });
}

export function useUpdateBusinessSettings() {
  const { data: businessId } = useBusinessId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<BusinessSettings>) => {
      const { error } = await supabase
        .from("settings")
        .update(updates)
        .eq("business_id", businessId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business_settings"] }),
  });
}
