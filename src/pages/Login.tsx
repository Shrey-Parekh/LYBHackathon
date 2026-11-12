import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { api, ApiError } from "../api/client";
import type { LoginResponse } from "../api/contract";
import { homeFor, setSession, useSession } from "../auth/session";
import { Button } from "../components/ui";
import { Footer, Mark } from "../components/AppShell";
import { ANY_MOCKS } from "../lib/env";

/* Fictional seeded accounts, offered as shortcuts only while the mock API is on. */
const MOCK_ACCOUNTS = [
  { role: "Coordinator", name: "Meera Kulkarni", email: "meera.kulkarni@plantx.example" },
  { role: "Driver", name: "Ravi Shinde, SHP-1001", email: "ravi.shinde@sahyadri.example" },
  { role: "Customer", name: "Anil Deshpande, Deccan Mouldings", email: "anil.deshpande@deccanmouldings.example" },
  { role: "Customer", name: "Nikhil Bhosale, Godavari Flexipack", email: "nikhil.bhosale@godavariflexi.example" },
];

export function Login() {
  const session = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={homeFor(session.user.role)} replace />;

  async function signIn(e?: FormEvent, override?: { email: string; password: string }) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<LoginResponse>("/auth/login", { method: "POST", body: override ?? { email, password } });
      setSession({ token: res.token, user: res.user });
      navigate(homeFor(res.user.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Email or password is not correct." : err instanceof Error ? `${err.message}.` : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-[12vh]">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-2">
            <Mark />
            <span className="font-semibold">Plant X Control Tower</span>
          </div>
          <h1 className="mt-8 text-figure font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-body text-muted">Coordinators, drivers and customers each use their own account.</p>

          <form onSubmit={signIn} className="mt-8 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-meta font-medium text-ink-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-body text-ink outline-none focus-visible:border-accent"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-meta font-medium text-ink-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-body text-ink outline-none focus-visible:border-accent"
              />
            </div>
            {error && (
              <p role="alert" className="text-body font-medium text-high">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !email || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {ANY_MOCKS && (
            <section aria-labelledby="mock-accounts" className="mt-10 border-t border-line pt-6">
              <h2 id="mock-accounts" className="text-body font-semibold">
                Demo accounts
              </h2>
              <p className="mt-1 text-meta text-muted">The mock API accepts any password for these fictional users.</p>
              <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
                {MOCK_ACCOUNTS.map((a) => (
                  <li key={a.email}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => signIn(undefined, { email: a.email, password: "mock" })}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-sunken"
                    >
                      <span>
                        <span className="block text-body font-medium">{a.role}</span>
                        <span className="block text-meta text-muted">{a.name}</span>
                      </span>
                      <span className="text-meta font-medium text-accent">Sign in</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
