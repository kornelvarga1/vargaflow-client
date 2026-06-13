import { useState, useEffect, useRef, useCallback } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { invokeFunction } from "@/lib/invokeFunction";

export type CallState = "idle" | "connecting" | "active" | "incoming";

export function useCallDevice(businessId: string | undefined) {
  const deviceRef = useRef<Device | null>(null);
  const [callState, setCallState] = useState<CallState>("idle");
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    let device: Device;

    const init = async () => {
      setInitError(null);
      const { data, error } = await invokeFunction<{ token: string }>("twilio-token", { business_id: businessId });
      if (error || !data?.token) {
        const msg = error?.message ?? "No token returned";
        console.error("[callDevice] token fetch failed:", msg);
        setInitError(`Token: ${msg}`);
        return;
      }

      device = new Device(data.token, { logLevel: "error" });

      device.on("registered", () => { setReady(true); setInitError(null); });
      device.on("unregistered", () => setReady(false));
      device.on("error", (err) => {
        console.error("[callDevice] error:", err);
        setInitError(`Device: ${err.message ?? String(err)}`);
      });
      device.on("tokenWillExpire", async () => {
        const { data } = await invokeFunction<{ token: string }>("twilio-token", { business_id: businessId });
        if (data?.token) device.updateToken(data.token);
      });

      device.on("incoming", (call: Call) => {
        setIncomingCall(call);
        setCallState("incoming");
        call.on("disconnect", () => { setIncomingCall(null); setCallState("idle"); });
        call.on("cancel", () => { setIncomingCall(null); setCallState("idle"); });
      });

      await device.register();
      deviceRef.current = device;
    };

    init();

    return () => {
      device?.unregister();
      device?.destroy();
    };
  }, [businessId]);

  const call = useCallback(async (toPhone: string, contactId: string) => {
    const device = deviceRef.current;
    if (!device || !ready || !businessId) return;

    setCallState("connecting");
    try {
      const c = await device.connect({ params: { To: toPhone, ContactId: contactId, BusinessId: businessId } });
      setActiveCall(c);
      setCallState("active");
      c.on("disconnect", () => { setActiveCall(null); setCallState("idle"); });
      c.on("error", () => { setActiveCall(null); setCallState("idle"); });
    } catch (err) {
      console.error("[callDevice] connect failed:", err);
      setCallState("idle");
    }
  }, [ready, businessId]);

  const hangup = useCallback(() => {
    activeCall?.disconnect();
    incomingCall?.reject();
    setActiveCall(null);
    setIncomingCall(null);
    setCallState("idle");
  }, [activeCall, incomingCall]);

  const answer = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.accept();
    setActiveCall(incomingCall);
    setIncomingCall(null);
    setCallState("active");
    incomingCall.on("disconnect", () => { setActiveCall(null); setCallState("idle"); });
  }, [incomingCall]);

  return { ready, callState, activeCall, incomingCall, call, hangup, answer, initError };
}
