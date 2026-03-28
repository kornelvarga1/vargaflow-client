import { useState, useEffect } from "react";
import { useCustomValues, useUpdateCustomValue, type CustomValue } from "@/hooks/useCustomValues";
import { useBusinessId } from "@/hooks/useBusinessId";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings, Check, Loader2, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { requestNotificationPermission, getNotificationPermissionState } from "@/hooks/usePushNotifications";


export default function SettingsPage() {
  const { data: customValues, isLoading } = useCustomValues();
  const updateMutation = useUpdateCustomValue();
  const { data: businessId } = useBusinessId();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
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
    if (dirty.length === 0) {
      toast.info("No changes to save");
      return;
    }
    try {
      await Promise.all(
        dirty.map((id) =>
          updateMutation.mutateAsync({ id, value: localValues[id] || "" })
        )
      );
      setDirtyKeys(new Set());
      toast.success(`Saved ${dirty.length} change(s)`);
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
          disabled={dirtyKeys.size === 0}
          className="gradient-primary text-primary-foreground"
        >
          <Check className="w-4 h-4 mr-1.5" />
          Save All
        </Button>
      </div>

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
          {items.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">{item.label}</Label>
              <div className="flex gap-2">
                <Input
                  value={localValues[item.id] ?? ""}
                  onChange={(e) => handleChange(item.id, e.target.value)}
                  placeholder={`Enter ${item.label.toLowerCase()}...`}
                  className="bg-secondary border-border"
                />
                {dirtyKeys.has(item.id) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSave(item.id)}
                    className="shrink-0"
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
