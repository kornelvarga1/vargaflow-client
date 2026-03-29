import { ReactNode, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Settings, MessageSquare, Menu, X, Zap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useConversationOpen } from "@/context/ConversationContext";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/messages", icon: MessageSquare, label: "Inbox" },
  { to: "/contacts", icon: Users, label: "Contacts" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

const mobileNavItems = navItems;

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut } = useAuth();
  const { isConversationOpen } = useConversationOpen();

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-sidebar shrink-0 border-t-[3px] border-t-primary">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Zap className="w-4 h-4 text-primary shrink-0" />
          <span className="text-[17px] font-display font-bold text-sidebar-foreground tracking-tight">VargaFlow</span>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-border">
          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-all duration-200"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile slide-out menu overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 bg-sidebar border-r border-border flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary shrink-0" />
                <span className="text-[17px] font-display font-bold text-sidebar-foreground tracking-tight">VargaFlow</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileMenuOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-0.5">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Mobile bottom nav — hidden when a conversation is open */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-border glass safe-bottom ${isConversationOpen ? "hidden" : ""}`}>
        {mobileNavItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-all active-press ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className={`p-1 rounded-md transition-colors ${isActive ? "bg-primary/15" : ""}`}>
                <item.icon className="w-4 h-4" />
              </div>
              <span>{item.label.split(" ")[0]}</span>
            </NavLink>
          );
        })}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground active-press"
        >
          <div className="p-1">
            <Menu className="w-4 h-4" />
          </div>
          <span>More</span>
        </button>
      </nav>

      {/* Main content */}
      <main className={`flex-1 min-h-0 md:pb-0 ${isConversationOpen ? "overflow-hidden pb-0 flex flex-col" : "overflow-auto pb-20"}`}>{children}</main>
    </div>
  );
}
