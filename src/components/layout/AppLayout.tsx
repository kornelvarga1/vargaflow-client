import { ReactNode, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Settings, MessageSquare, WifiOff } from "lucide-react";
import { useConversationOpen } from "@/context/ConversationContext";

function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  if (online) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You're offline — data shown may be out of date.</span>
    </div>
  );
}

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/messages", icon: MessageSquare, label: "Inbox", end: false },
  { to: "/contacts", icon: Users, label: "Contacts", end: false },
  { to: "/settings", icon: Settings, label: "Settings", end: false },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isConversationOpen } = useConversationOpen();

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background">
      <OfflineBanner />
      <div className="flex flex-1 min-h-0">
        {/* Desktop left rail — slim, icon-only */}
        <aside
          aria-label="Primary"
          className="hidden md:flex w-16 flex-col items-center py-4 gap-1 border-r border-border/40 bg-background shrink-0"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) =>
                `flex items-center justify-center w-10 h-10 rounded-xl transition-colors active-press ${
                  isActive
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`
              }
            >
              <item.icon className="w-5 h-5" strokeWidth={1.75} />
            </NavLink>
          ))}
        </aside>

        <main
          className={
            isConversationOpen
              ? "flex-1 min-h-0 overflow-hidden flex flex-col"
              : "flex-1 min-h-0 overflow-auto pb-32 md:pb-0"
          }
        >
          {children}
        </main>
      </div>

      {/* Mobile floating bar — hidden on md+ and when a conversation is open */}
      <nav
        aria-label="Primary"
        className={`md:hidden fixed left-1/2 -translate-x-1/2 z-40 ${isConversationOpen ? "hidden" : "flex"} items-center gap-1 rounded-3xl border border-border/60 glass shadow-float px-2 py-2`}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            aria-label={item.label}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-medium transition-colors active-press ${
                isActive
                  ? "bg-secondary text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span className={isActive ? "inline" : "hidden"}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
