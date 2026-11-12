import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { motion } from "motion/react";
import L from "leaflet";
import { ArrowRight, Buildings, ClipboardText, Truck, type Icon } from "@phosphor-icons/react";
import { api, ApiError } from "../api/client";
import type { LoginResponse } from "../api/contract";
import { homeFor, setSession, useSession } from "../auth/session";
import { Button } from "../components/ui";
import { FICTIONAL_NOTICE, Mark, ThemeToggle } from "../components/AppShell";
import { ANY_MOCKS } from "../lib/env";
import { duration, easeOut } from "../lib/motion";

/* Fictional seeded accounts, offered as one-tap sign-in only while the mock API is on. */
const MOCK_ACCOUNTS: { role: string; who: string; email: string; icon: Icon }[] = [
  { role: "Coordinator", who: "Meera Kulkarni, Plant X logistics", email: "meera.kulkarni@plantx.example", icon: ClipboardText },
  { role: "Driver", who: "Ravi Shinde, trip SHP-1001", email: "ravi.shinde@sahyadri.example", icon: Truck },
  { role: "Customer", who: "Anil Deshpande, Deccan Mouldings", email: "anil.deshpande@deccanmouldings.example", icon: Buildings },
  { role: "Customer", who: "Nikhil Bhosale, Godavari Flexipack", email: "nikhil.bhosale@godavariflexi.example", icon: Buildings },
];

const rise = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: duration.slow, ease: easeOut, delay: 0.06 * i },
});

export function Login() {
  const session = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (session) return <Navigate to={homeFor(session.user.role)} replace />;

  async function signIn(e?: FormEvent, override?: { email: string; password: string }) {
    e?.preventDefault();
    setBusy(override?.email ?? "form");
    setError(null);
    try {
      const res = await api<LoginResponse>("/auth/login", { method: "POST", body: override ?? { email, password } });
      setSession({ token: res.token, user: res.user });
      navigate(homeFor(res.user.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Email or password is not correct." : err instanceof Error ? `${err.message}.` : "Sign-in failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Left: what this is, over a muted live map of the Panvel corridor */}
      <section className="relative flex flex-col overflow-hidden bg-rail px-6 py-6 text-rail-ink sm:px-10 lg:min-h-dvh lg:py-10">
        <div className="relative z-[1] flex items-center gap-2.5 font-semibold text-[#eef2ef]">
          <Mark />
          Plant X Control Tower
        </div>
        <div className="relative z-[1] mt-12 max-w-[40rem] lg:mt-auto">
          <motion.h1 {...rise(0)} className="text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.025em] text-[#eef2ef] sm:text-[2.5rem]">
            Know which delivery will be late while there is still time to act.
          </motion.h1>
          <motion.p {...rise(1)} className="mt-5 max-w-[30rem] text-lead text-rail-ink">
            Live position, an ETA that explains itself, and every decision on record. One view for coordinators, drivers and customers.
          </motion.p>
        </div>
        <motion.div {...rise(2)} className="relative z-[1] mt-10 hidden overflow-hidden rounded-lg border border-rail-2 lg:block">
          <CorridorMap />
        </motion.div>
        <p className="relative z-[1] mt-6 text-meta text-rail-muted lg:mt-6">{FICTIONAL_NOTICE}</p>
      </section>

      {/* Right: sign in */}
      <main id="main" className="relative flex flex-col bg-canvas px-6 py-8 sm:px-10 lg:justify-center lg:py-10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="mx-auto w-full max-w-[420px]">
          <motion.h2 {...rise(1)} className="text-figure font-semibold tracking-[-0.02em]">
            Sign in
          </motion.h2>
          <motion.p {...rise(2)} className="mt-1 text-body text-muted">
            Each role signs in with its own account and sees only its own shipments.
          </motion.p>

          <motion.form {...rise(3)} onSubmit={signIn} className="mt-7 space-y-4" noValidate>
            <Field id="email" label="Email" type="email" autoComplete="username" value={email} onChange={setEmail} />
            <Field id="password" label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
            {error && (
              <p role="alert" className="text-body font-medium text-high">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!!busy || !email || !password}>
              {busy === "form" ? "Signing in…" : "Sign in"}
            </Button>
          </motion.form>

          {ANY_MOCKS && (
            <motion.section {...rise(4)} aria-labelledby="mock-accounts" className="mt-10">
              <div className="flex items-baseline justify-between gap-3">
                <h3 id="mock-accounts" className="text-body font-semibold">
                  Try a demo account
                </h3>
                <p className="text-meta text-muted">Mock API, any password</p>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {MOCK_ACCOUNTS.map((a, i) => (
                  <motion.li key={a.email} {...rise(5 + i)}>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => signIn(undefined, { email: a.email, password: "mock" })}
                      className="group flex h-full w-full items-start gap-3 rounded-lg border border-line bg-surface p-3.5 text-left transition-[border-color,background-color,transform] duration-200 ease-out hover:border-accent hover:bg-raised active:scale-[0.98]"
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sunken text-ink-2 transition-colors duration-200 group-hover:bg-accent group-hover:text-on-accent">
                        <a.icon size={18} weight="bold" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-body font-semibold">
                          {busy === a.email ? "Signing in…" : a.role}
                          <ArrowRight size={14} weight="bold" aria-hidden className="text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent" />
                        </span>
                        <span className="block text-meta text-muted">{a.who}</span>
                      </span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            </motion.section>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ id, label, type, autoComplete, value, onChange }: { id: string; label: string; type: string; autoComplete: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-meta font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-md border border-line-strong bg-raised px-3 text-body text-ink outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
      />
    </div>
  );
}

/** A still, muted map of the Panvel to Pune and Nashik corridor: real tiles, no data, no interaction. */
function CorridorMap() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false });
    m.setView([19.25, 73.45], 8);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(m);
    return () => {
      m.remove();
    };
  }, []);
  return <div ref={el} className="ct-map ct-map-rail h-[240px]" aria-hidden />;
}
