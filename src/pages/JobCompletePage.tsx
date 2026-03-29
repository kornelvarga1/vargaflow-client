import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface Settings {
  company_name: string;
}

type FormState = "idle" | "submitting" | "success" | "error";

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

export default function JobCompletePage() {
  const [searchParams] = useSearchParams();
  const business_id = searchParams.get("business_id") ?? "";

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const [formState, setFormState] = useState<FormState>("idle");
  const [submittedName, setSubmittedName] = useState("");

  // ── Fetch settings ────────────────────────────────────────────
  useEffect(() => {
    if (!business_id) {
      setLoadError("Missing business_id parameter.");
      return;
    }

    supabase
      .from("settings")
      .select("company_name")
      .eq("business_id", business_id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setLoadError("Could not load business settings.");
        } else {
          setSettings({ company_name: data.company_name });
        }
      });
  }, [business_id]);

  // ── Validation ────────────────────────────────────────────────
  function validate(): boolean {
    let ok = true;
    if (!firstName.trim()) {
      setFirstNameError("Please enter the customer's first name.");
      ok = false;
    } else {
      setFirstNameError("");
    }
    if (digitsOnly(phone).length !== 10) {
      setPhoneError("Please enter a valid 10-digit phone number.");
      ok = false;
    } else {
      setPhoneError("");
    }
    return ok;
  }

  // ── Submit ────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setFormState("submitting");
    const name = firstName.trim();
    const digits = digitsOnly(phone);

    try {
      const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/one-year-followup-entry`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          business_id,
          contact_first_name: name,
          contact_phone: digits,
        }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setSubmittedName(name);
      setFormState("success");
    } catch {
      setFormState("error");
    }
  }

  // ── Loading ───────────────────────────────────────────────────
  if (!settings && !loadError) {
    return (
      <div style={styles.page}>
        <div style={{ color: "#8e8e93", fontSize: 15 }}>Loading…</div>
      </div>
    );
  }

  // ── Error loading settings ────────────────────────────────────
  if (loadError) {
    return (
      <div style={styles.page}>
        <div style={{ color: "#f87171", fontSize: 15 }}>{loadError}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Card */}
      <div style={styles.card}>
        <h1 style={styles.heading}>{settings!.company_name}</h1>

        {/* Info box */}
        <div style={styles.infoBox}>
          <p style={styles.infoStep}>
            1. ⭐ This will send out your 5 star review request funnel (gate keeping negative reviews)
          </p>
          <p style={styles.infoBody}>
            — Customer will be reminded to leave you a 5★ review 4 times over a 4 week period
          </p>
          <p style={styles.infoNote}>(*automation will stop if they leave a review*)</p>
          <p style={styles.infoArrow}>👇</p>
          <p style={styles.infoStep}>
            2. 🗓️ Customer will be put into your 1 year follow up sequence
          </p>
          <p style={styles.infoBody}>
            — Customer will be texted every 2–3 months reminding them of your return customer
            discount + requesting referrals for the same discount
          </p>
          <p style={{ ...styles.infoBody, color: "#ffffff", fontWeight: 600, marginTop: 8 }}>
            Fill in the information below 👇👇👇
          </p>
        </div>

        {/* Form / Success */}
        {formState === "success" ? (
          <p style={styles.successMsg}>
            ✅ Done! <strong>{submittedName}</strong> has been added to your review + follow-up
            sequence. They will receive a review request shortly.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* First name */}
            <div style={styles.field}>
              <label style={styles.label}>Customer First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (firstNameError) setFirstNameError("");
                }}
                placeholder="Customers First name (For example: John)"
                style={{
                  ...styles.input,
                  borderColor: firstNameError ? "#f87171" : "#3a3a3c",
                }}
                required
              />
              {firstNameError && <p style={styles.fieldError}>{firstNameError}</p>}
            </div>

            {/* Phone */}
            <div style={styles.field}>
              <label style={styles.label}>Phone</label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError("");
                }}
                placeholder="Phone (For example: 8085551234)"
                style={{
                  ...styles.input,
                  borderColor: phoneError ? "#f87171" : "#3a3a3c",
                }}
                required
              />
              {phoneError && <p style={styles.fieldError}>{phoneError}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={formState === "submitting"}
              style={{
                ...styles.submitBtn,
                opacity: formState === "submitting" ? 0.6 : 1,
                cursor: formState === "submitting" ? "default" : "pointer",
              }}
            >
              {formState === "submitting" ? "Submitting…" : "Submit!"}
            </button>

            {formState === "error" && (
              <p style={styles.formError}>Something went wrong. Please try again.</p>
            )}
          </form>
        )}
      </div>

      <footer style={styles.footer}>Powered by VargaFlow</footer>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "#1c1c1e",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "28px 16px 56px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#ffffff",
  },
  card: {
    background: "#2c2c2e",
    borderRadius: 20,
    padding: "28px 22px",
    width: "100%",
    maxWidth: 480,
    border: "1px solid #3a3a3c",
  },
  heading: {
    fontSize: 21,
    fontWeight: 700,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 22,
  },
  infoBox: {
    background: "#1c1c1e",
    borderLeft: "3px solid #D4860A",
    borderRadius: 8,
    padding: "16px 16px 16px 18px",
    marginBottom: 26,
    fontSize: 13,
    lineHeight: 1.75,
    color: "#8e8e93",
  },
  infoStep: {
    color: "#ffffff",
    fontWeight: 600,
    marginBottom: 4,
  },
  infoBody: {
    marginBottom: 4,
  },
  infoNote: {
    color: "#8e8e93",
    fontStyle: "italic",
    marginBottom: 4,
  },
  infoArrow: {
    textAlign: "center",
    fontSize: 18,
    margin: "4px 0",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 7,
  },
  input: {
    width: "100%",
    background: "#3a3a3c",
    border: "1px solid",
    borderRadius: 10,
    padding: "13px 14px",
    fontSize: 16,
    color: "#ffffff",
    outline: "none",
    fontFamily: "inherit",
    WebkitAppearance: "none",
  },
  fieldError: {
    color: "#f87171",
    fontSize: 12,
    marginTop: 6,
  },
  submitBtn: {
    width: "100%",
    background: "#D4860A",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "16px",
    fontSize: 18,
    fontWeight: 800,
    marginTop: 6,
    transition: "filter 0.15s",
    fontFamily: "inherit",
    letterSpacing: "0.01em",
  },
  formError: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
    marginTop: 14,
  },
  successMsg: {
    textAlign: "center",
    padding: "20px 0 8px",
    fontSize: 16,
    lineHeight: 1.7,
    color: "#86efac",
  },
  footer: {
    marginTop: 28,
    fontSize: 12,
    color: "#3a3a3c",
  },
};
