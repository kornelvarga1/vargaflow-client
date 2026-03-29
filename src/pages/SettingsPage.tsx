import { useState, useEffect } from "react";
import { useCustomValues, useUpdateCustomValue, type CustomValue } from "@/hooks/useCustomValues";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useBusinessSettings, useUpdateBusinessSettings, type BusinessSettings } from "@/hooks/useBusinessSettings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings, Check, Loader2, Bell, BellOff, Moon, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { requestNotificationPermission, getNotificationPermissionState } from "@/hooks/usePushNotifications";
import { Switch } from "@/components/ui/switch";
import { useDarkMode } from "@/hooks/useDarkMode";


const SETTINGS_FIELDS: { key: keyof BusinessSettings; label: string; isUrl: boolean }[] = [
  { key: "my_name", label: "My Name", isUrl: false },
  { key: "my_phone", label: "My Phone", isUrl: false },
  { key: "my_email", label: "My Email", isUrl: false },
  { key: "company_name", label: "Company Name", isUrl: false },
  { key: "gmb_review_link", label: "GMB Review Link", isUrl: true },
  { key: "quote_form_link", label: "Quote Form Link", isUrl: true },
  { key: "marketing_form_link", label: "Marketing Form Link", isUrl: true },
];

export default function SettingsPage() {
  const { isDark, toggle } = useDarkMode();
  const { data: customValues, isLoading } = useCustomValues();
  const updateMutation = useUpdateCustomValue();
  const { data: businessId } = useBusinessId();
  const { data: businessSettings } = useBusinessSettings();
  const updateSettings = useUpdateBusinessSettings();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [settingsLocal, setSettingsLocal] = useState<Record<string, string>>({});
  const [settingsDirty, setSettingsDirty] = useState<Set<string>>(new Set());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    getNotificationPermissionState().then(setNotifPermission);
  }, []);

  useEffect(() => {
    if (customValues) {
      const vals: Record<string, string> = {};
      customValues.forEach((v) => (vals[v.id] = v.value));
      setLocalValues(vals);
    }
  }, [customValues]);

  useEffect(() => {
    if (businessSettings) {
      setSettingsLocal(businessSettings as unknown as Record<string, string>);
    }
  }, [businessSettings]);

  const handleChange = (id: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [id]: value }));
    setDirtyKeys((prev) => new Set(prev).add(id));
  };

  const handleSave = async (id: string) => {
    try {
      await updateMutation.mutateAsync({ id, value: localValues[id] || "" });
      setDirtyKeys((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Saved!");
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleSaveAll = async () => {
    const dirty = Array.from(dirtyKeys);
    const hasSettingsDirty = settingsDirty.size > 0;
    if (dirty.length === 0 && !hasSettingsDirty) {
      toast.info("No changes to save");
      return;
    }
    try {
      await Promise.all([
        ...dirty.map((id) =>
          updateMutation.mutateAsync({ id, value: localValues[id] || "" })
        ),
        ...(hasSettingsDirty
          ? [updateSettings.mutateAsync(
              Object.fromEntries(
                Array.from(settingsDirty).map((k) => [k, settingsLocal[k] || ""])
              ) as Partial<BusinessSettings>
            )]
          : []),
      ]);
      setDirtyKeys(new Set());
      setSettingsDirty(new Set());
      toast.success(`Saved ${dirty.length + (hasSettingsDirty ? settingsDirty.size : 0)} change(s)`);
    } catch {
      toast.error("Failed to save some values");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = (customValues || []).filter((v) => v.category === "general");

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your business information.</p>
        </div>
        <Button
          onClick={handleSaveAll}
          disabled={dirtyKeys.size === 0 && settingsDirty.size === 0}
          className="gradient-primary text-primary-foreground"
        >
          <Check className="w-4 h-4 mr-1.5" />
          Save All
        </Button>
      </div>

      {/* Appearance */}
      <Card className="bg-card border-border shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Moon className="w-4 h-4 text-accent-foreground" />
            Appearance
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground mt-0.5">Switch app theme</p>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={toggle}
              className="data-[state=checked]:bg-[#D4860A]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card className="bg-card border-border shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Bell className="w-4 h-4 text-accent-foreground" />
            Push Notifications
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Inbound message alerts</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {notifPermission === "granted"
                  ? "Notifications are enabled on this device."
                  : notifPermission === "denied"
                  ? "Blocked in browser settings — reset site permissions to re-enable."
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
                  <><Bell className="w-4 h-4 mr-1.5" />Enabled</>
                ) : (
                  <><Bell className="w-4 h-4 mr-1.5" />Enable</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Settings className="w-4 h-4 text-accent-foreground" />
            General Information
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 space-y-4">
          {SETTINGS_FIELDS.map(({ key, label, isUrl }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">{label}</Label>
              <div className="flex gap-2">
                <Input
                  value={settingsLocal[key] ?? ""}
                  onChange={(e) => {
                    setSettingsLocal((prev) => ({ ...prev, [key]: e.target.value }));
                    setSettingsDirty((prev) => new Set(prev).add(key));
                  }}
                  placeholder={`Enter ${label.toLowerCase()}...`}
                  className="bg-secondary border-border"
                />
                {isUrl && settingsLocal[key] && (
                  <a href={settingsLocal[key]} target="_blank" rel="noopener noreferrer">
                    <Button type="button" variant="outline" size="icon" className="shrink-0">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
