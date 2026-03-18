import { Link } from "react-router-dom";
import NeedsAttentionSection from "@/components/dashboard/NeedsAttentionSection";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useActivityLog } from "@/hooks/useActivityLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  MessageSquare,
  UserPlus,
  ArrowRightLeft,
  Send,
  Star,
  Clock,
  ArrowRight,
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
  const { data: activities = [], isLoading: actLoading } = useActivityLog(15);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 animate-slide-up">
      <div>
        <h1 className="text-3xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back.</p>
      </div>

      <NeedsAttentionSection />

      {statsLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 stagger-in">
          <StatCard icon={UserPlus} label="New Leads This Week" value={stats?.newLeadsThisWeek ?? 0} to="/contacts" />
          <StatCard
            icon={MessageSquare}
            label="Unread Messages"
            value={stats?.unreadMessages ?? 0}
            to="/messages"
            highlight={!!stats?.unreadMessages}
          />
          <StatCard icon={Users} label="Contacts in Pipeline" value={stats?.contactsInPipeline ?? 0} to="/contacts" />
          <StatCard icon={Star} label="Reviews Collected" value={stats?.reviewsCollected ?? 0} to="/contacts" />
        </div>
      )}

      {/* Activity Log */}
      <Card className="bg-card border-border shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Clock className="w-4 h-4 text-accent-foreground" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          {actLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No activity yet. Start by adding contacts.
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => {
                const Icon = activityIcons[a.activity_type] || Activity;
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        {a.contacts?.full_name && (
                          <span className="font-medium text-accent-foreground">{a.contacts.full_name}</span>
                        )}{" "}
                        {a.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  to,
  highlight,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  to: string;
  highlight?: boolean;
}) {
  return (
    <Link to={to}>
      <Card
        className={`bg-card border-border shadow-card hover:shadow-glow transition-shadow cursor-pointer group ${
          highlight ? "border-teal-400/50" : ""
        }`}
      >
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${highlight ? "bg-teal-500/15" : "bg-teal-500/10"}`}>
              <Icon className={`w-4 h-4 ${highlight ? "text-teal-700" : "text-teal-600"}`} />
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <p className={`text-2xl font-display font-bold ${highlight ? "text-teal-700" : ""}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
