import { useState, useEffect } from "react";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useBusinessSettings, useUpdateBusinessSettings, type BusinessSettings } from "@/hooks/useBusinessSettings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, LogOut } from "lucide-react";
import { toast } from "sonner";
import { requestNotificationPermission, getNotificationPermissionState } from "@/hooks/usePushNotifications";
import { Switch } from "@/components/ui/switch";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useAuth } from "@/hooks/useAuth";

const SETTINGS_FIELDS: { key: keyof BusinessSettings; label: string; isUrl: boolean }[] = [
  { key: "my_name", label: "My Name", isUrl: false },
  { key: "my_phone", label: "My Phone", isUrl: false },
  { key: "my_email", label: "My Email", isUrl: false },
  { key: "company_name", label: "Company Name", isUrl: false },
  { key: "gmb_review_link", label: "GMB Review Link", isUrl: true },
  { key: "quote_form_link", label: "Quote Form Link", isUrl: true },
  { key: "marketing_form_link", label: "Marketing Form Link", isUrl: true },
];

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground px-4 pb-2 pt-8">
      {children}
    </h2>
  );
}

function GroupedList({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border/60 divide-y divide-border/50 overflow-hidden">
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { isDark, toggle } = useDarkMode();
  const { signOut } = useAuth();
  const { data: businessId } = useBusinessId();
  const { data: businessSettings, isLoading } = useBusinessSettings();
  const updateSettings = useUpdateBusinessSettings();
  const [settingsLocal, setSettingsLocal] = useState<Record<string, string>>({});
  const [savedSnapshot, setSavedSnapshot] = useState<Record<string, string>>({});
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    getNotificationPermissionState().then(setNotifPermission);
  }, []);

  useEffect(() => {
    if (businessSettings) {
      const snap = businessSettings as unknown as Record<string, string>;
      setSettingsLocal(snap);
      setSavedSnapshot(snap);
    }
  }, [businessSettings]);

  const handleBlur = async (key: keyof BusinessSettings) => {
    const value = settingsLocal[key] ?? "";
    if ((savedSnapshot[key] ?? "") === value) return;
    try {
      await updateSettings.mutateAsync({ [key]: value } as Partial<BusinessSettings>);
      setSavedSnapshot((prev) => ({ ...prev, [key]: value }));
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 pt-8 max-w-2xl mx-auto animate-fade-in">
      <header className="px-1 pb-2">
        <h1 className="font-serif text-3xl text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your business information.</p>
      </header>

      <SectionHeader>Appearance</SectionHeader>
      <GroupedList>
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <p className="text-sm text-foreground">Dark Mode</p>
          <Switch checked={isDark} onCheckedChange={toggle} />
        </div>
      </GroupedList>

      <SectionHeader>Notifications</SectionHeader>
      <GroupedList>
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">Inbound message alerts</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {notifPermission === "granted"
                ? "Enabled on this device."
                : notifPermission === "denied"
                ? "Blocked — reset site permissions to re-enable."
                : notifPermission === "unsupported"
                ? "Not supported in this browser."
                : "Get notified instantly when a lead replies."}
            </p>
          </div>
          {notifPermission !== "unsupported" && notifPermission !== "denied" && (
            <Button
              size="sm"
              variant={notifPermission === "granted" ? "outline" : "default"}
              disabled={notifLoading || notifPermission === "granted"}
              onClick={async () => {
                if (!businessId) { toast.error("Business ID not loaded yet"); return; }
                setNotifLoading(true);
                const ok = await requestNotificationPermission(businessId);
                setNotifPermission(ok ? "granted" : Notification.permission);
                if (ok) toast.success("Push notifications enabled");
                else toast.error("Could not enable notifications");
                setNotifLoading(false);
              }}
              className="shrink-0"
            >
              {notifLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : notifPermission === "granted" ? (
                "Enabled"
              ) : (
                "Enable"
              )}
            </Button>
          )}
        </div>
      </GroupedList>

      <SectionHeader>General Information</SectionHeader>
      <GroupedList>
        {SETTINGS_FIELDS.map(({ key, label, isUrl }) => (
          <div key={key} className="px-4 py-3 space-y-1.5">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <div className="flex gap-2">
              <Input
                value={settingsLocal[key] ?? ""}
                onChange={(e) =>
                  setSettingsLocal((prev) => ({ ...prev, [key]: e.target.value }))
                }
                onBlur={() => handleBlur(key)}
                placeholder={`Enter ${label.toLowerCase()}...`}
                className="bg-transparent border-0 px-0 h-9 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
              />
              {isUrl && settingsLocal[key] && (
                <a href={settingsLocal[key]} target="_blank" rel="noopener noreferrer">
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-muted-foreground">
                    <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                  </Button>
                </a>
              )}
            </div>
          </div>
        ))}
      </GroupedList>

      <SectionHeader>Account</SectionHeader>
      <GroupedList>
        <button
          onClick={signOut}
          className="flex items-center justify-between gap-4 w-full px-4 py-3.5 hover:bg-secondary/40 transition-colors text-left active-press"
        >
          <span className="text-sm text-foreground">Sign out</span>
          <LogOut className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        </button>
      </GroupedList>

      <div className="h-12" />
    </div>
  );
}
