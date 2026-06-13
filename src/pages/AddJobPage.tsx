import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { invokeFunction } from "@/lib/invokeFunction";
import { normalizePhone } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type FormState = "idle" | "submitting" | "success" | "error";

interface ContactResult {
  id: string;
  full_name: string;
  phone: string | null;
}

function useContactSearch(query: string, businessId: string | undefined) {
  const [results, setResults] = useState<ContactResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || !businessId || query.length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("contacts")
        .select("id, full_name, phone")
        .eq("business_id", businessId)
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(6);
      setResults((data as ContactResult[]) ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, businessId]);

  return { results, loading };
}

export default function AddJobPage() {
  const { data: businessId } = useBusinessId();

  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [submittedName, setSubmittedName] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { results, loading: searchLoading } = useContactSearch(searchQuery, businessId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectContact(contact: ContactResult) {
    const first = contact.full_name.trim().split(/\s+/)[0] || contact.full_name.trim();
    setFirstName(first);
    setPhone(contact.phone || "");
    setFirstNameError("");
    setPhoneError("");
    setSearchQuery("");
    setShowResults(false);
  }

  function validate(): boolean {
    let ok = true;
    if (!firstName.trim()) {
      setFirstNameError("Enter the customer's first name.");
      ok = false;
    } else {
      setFirstNameError("");
    }
    const digits = normalizePhone(phone);
    if (!digits || digits.length !== 10) {
      setPhoneError("Enter a valid 10-digit phone number.");
      ok = false;
    } else {
      setPhoneError("");
    }
    return ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !businessId) return;

    setFormState("submitting");
    const name = firstName.trim();

    const { error } = await invokeFunction("one-year-followup-entry", {
      business_id: businessId,
      contact_first_name: name,
      contact_phone: normalizePhone(phone),
    });

    if (error) {
      setFormState("error");
      return;
    }

    setSubmittedName(name);
    setFormState("success");
  }

  function reset() {
    setFirstName("");
    setPhone("");
    setFirstNameError("");
    setPhoneError("");
    setFormState("idle");
    setSearchQuery("");
  }

  return (
    <div className="px-4 md:px-6 pt-8 max-w-2xl mx-auto animate-slide-up">
      <header className="px-1 mb-6">
        <h1 className="font-serif text-3xl text-foreground">Job Complete</h1>
      </header>

      <div className="bg-card border border-border/60 rounded-2xl p-5 mb-4">
        <div className="border-l-2 border-primary pl-4 space-y-2 text-sm">
          <p className="font-medium text-foreground">1. ⭐ This will send out your 5 star review request funnel (gate keeping negative reviews)</p>
          <p className="text-muted-foreground">— Customer will be reminded to leave you a 5★ review 4 times over a 4 week period</p>
          <p className="text-muted-foreground italic">(*automation will stop if they leave a review*)</p>
          <p className="font-medium text-foreground pt-1">2. 🗓️ Customer will be put into your 1 year follow up sequence</p>
          <p className="text-muted-foreground">— Customer will be texted every 2–3 months reminding them of your return customer discount + requesting referrals for the same discount</p>
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-2xl p-5">
        {formState === "success" ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-500" strokeWidth={1.5} />
            <div>
              <p className="text-base font-medium text-foreground">{submittedName} is all set</p>
              <p className="text-sm text-muted-foreground mt-1">
                Review request goes out shortly. They're enrolled in the 1-year follow-up.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={reset} className="mt-2">
              Add another
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Contact search */}
            <div ref={searchRef} className="relative">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Search Existing Contact
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" strokeWidth={1.5} />
                <Input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                  onFocus={() => setShowResults(true)}
                  placeholder="Search by name or number…"
                  className="pl-9 pr-8"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); setShowResults(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                )}
              </div>
              {showResults && searchQuery.length >= 2 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-card border border-border/60 rounded-xl shadow-lg overflow-hidden">
                  {searchLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" strokeWidth={1.5} />
                    </div>
                  ) : results.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No contacts found.</p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {results.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => selectContact(c)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                              {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-border/40" />

            {/* Manual fields */}
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-xs text-muted-foreground uppercase tracking-wide">
                Customer First Name
              </Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); if (firstNameError) setFirstNameError(""); }}
                placeholder="e.g. John"
                className={firstNameError ? "border-destructive" : ""}
              />
              {firstNameError && <p className="text-xs text-destructive">{firstNameError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs text-muted-foreground uppercase tracking-wide">
                Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(""); }}
                placeholder="e.g. 8085551234"
                className={phoneError ? "border-destructive" : ""}
              />
              {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
            </div>

            {formState === "error" && (
              <p className="text-sm text-destructive text-center">Something went wrong — try again.</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={formState === "submitting" || !businessId}
            >
              {formState === "submitting" ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</>
              ) : (
                "Submit"
              )}
            </Button>
          </form>
        )}
      </div>

      <div className="h-12" />
    </div>
  );
}
