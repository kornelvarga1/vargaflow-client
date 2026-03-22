import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProfileState =
  | { status: "loading" }
  | { status: "ok" }
  | { status: "redirect"; message: string };

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const [profileState, setProfileState] = useState<ProfileState>({ status: "loading" });

  useEffect(() => {
    if (loading) return;

    if (!session) {
      setProfileState({ status: "ok" }); // handled by the !session guard below
      return;
    }

    supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single()
      .then(async ({ data: profile, error }) => {
        if (error?.code === "PGRST116" || !profile) {
          // No row found
          await supabase.auth.signOut();
          setProfileState({ status: "redirect", message: "Account not found. Please contact support." });
          return;
        }
        if (profile.role === "admin") {
          await supabase.auth.signOut();
          setProfileState({ status: "redirect", message: "Access denied. Please use the admin portal." });
          return;
        }
        setProfileState({ status: "ok" });
      });
  }, [session, loading]);

  if (loading || (!session && profileState.status === "loading") || (session && profileState.status === "loading")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profileState.status === "redirect") {
    return <Navigate to={`/login?error=${encodeURIComponent(profileState.message)}`} replace />;
  }

  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
