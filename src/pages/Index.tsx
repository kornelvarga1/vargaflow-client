import { useState } from "react";
import { Link } from "react-router-dom";
import NeedsAttentionSection from "@/components/dashboard/NeedsAttentionSection";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserPlus,
  ArrowRightLeft,
  Send,
  Loader2,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const activityIcons: Record<string, typeof Activity> = {
  contact_created: UserPlus,
  stage_changed: ArrowRightLeft,
  message_sent: Send,
  contact_updated: Users,
};

export default function Index() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activities = [], isLoading: actLoading } = useActivityLog(50);
  const [activityCount, setActivityCount] = useState(8);
  const { data: bizSettings } = useBusinessSettings();
  const firstName = bizSettings?.my_name?.split(" ")[0] || "";

  return (
    <div className="px-4 md:px-6 pt-8 max-w-2xl mx-auto animate-slide-up">
      <header className="px-1 mb-6">
        <h1 className="font-serif text-3xl text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </p>
      </header>

      <NeedsAttentionSection />

      {/* Stats — asymmetric: hero + 2 secondary */}
      <div className="mt-5 space-y-3">
        {statsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Link
              to="/messages"
              className="block bg-card border border-border/60 rounded-2xl px-5 py-6 hover:bg-secondary/20 transition-colors"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Messages sent this week
              </p>
              <p className="font-serif text-5xl text-foreground tabular-nums leading-none mt-3">
                {stats?.messagesSentThisWeek ?? 0}
              </p>
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <SecondaryStat
                label="New leads"
                value={stats?.newLeadsThisWeek ?? 0}
                to="/contacts"
              />
              <SecondaryStat
                label="Unread"
                value={stats?.unreadMessages ?? 0}
                to="/messages"
              />
            </div>
          </>
        )}
      </div>

      {/* Recent Activity */}
      <section className="mt-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground px-1 mb-3">
          Recent Activity
        </p>
        <div className="bg-card border border-border/60 rounded-2xl p-4">
          {actLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No activity yet. Start by adding contacts.
            </p>
          ) : (
            <ul className="space-y-3">
              {activities.slice(0, activityCount).map((a) => {
                const Icon = activityIcons[a.activity_type] || Activity;
                return (
                  <li key={a.id} className="flex items-start gap-3">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground/90 leading-snug">
                        {a.contacts?.full_name && (
                          <span className="font-medium text-foreground">{a.contacts.full_name}</span>
                        )}{" "}
                        {a.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {activities.length > activityCount && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground mt-2"
              onClick={() => setActivityCount((c) => c + 8)}
            >
              Show more ({activities.length - activityCount} remaining)
            </Button>
          )}
        </div>
      </section>

      <div className="h-12" />
    </div>
  );
}

function SecondaryStat({
  label,
  value,
  to,
}: {
  label: string;
  value: number;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="block bg-card border border-border/60 rounded-2xl px-4 py-4 hover:bg-secondary/20 transition-colors"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="font-serif text-3xl text-foreground tabular-nums leading-none mt-2">
        {value}
      </p>
    </Link>
  );
}
