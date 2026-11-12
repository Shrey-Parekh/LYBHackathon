import { type ReactNode } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowsClockwise, SignOut } from "@phosphor-icons/react";
import { homeFor, setSession, useSession } from "../auth/session";
import { useLiveUpdates, useStreamStatus } from "../api/stream";
import type { Role } from "../api/contract";
import { ANY_MOCKS, DEMO_MODE } from "../lib/env";
import { fadeIn } from "../lib/motion";
import { NotificationBell } from "./NotificationBell";

export const FICTIONAL_NOTICE = "Fictional demo data. Plant X is a fictional company.";

/** Redirects to /login without a session, and to the user's own home for another role's path (DESIGN.md 7.1). */
export function RequireRole({ role }: { role: Role }) {
  const session = useSession();
  if (!session) return <Navigate to="/login" replace />;
  if (session.user.role !== role) return <Navigate to={homeFor(session.user.role)} replace />;
  return <Shell role={role} />;
}

const NAV: Record<Role, { to: string; label: string; end?: boolean }[]> = {
  COORDINATOR: [
    { to: "/coordinator", label: "Attention", end: true },
    { to: "/coordinator/dashboard", label: "Dashboard" },
    { to: "/coordinator/ledger", label: "Decision ledger" },
    ...(DEMO_MODE ? [{ to: "/coordinator/demo", label: "Demo controls" }] : []),
  ],
  DRIVER: [],
  CUSTOMER: [{ to: "/customer", label: "My deliveries", end: true }],
};

const ROLE_WORD: Record<Role, string> = { COORDINATOR: "Coordinator", DRIVER: "Driver", CUSTOMER: "Customer" };

function Shell({ role }: { role: Role }) {
  const session = useSession()!;
  const qc = useQueryClient();
  const location = useLocation();
  useLiveUpdates(qc, session.token);
  const narrow = role === "DRIVER";

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="border-b border-line bg-surface">
        <div className={`mx-auto flex items-center gap-3 px-4 ${narrow ? "h-14 max-w-xl" : "h-16 max-w-[1440px] sm:px-6"}`}>
          <NavLink to={homeFor(role)} className="flex items-center gap-2 rounded-sm font-semibold text-ink">
            <Mark />
            <span className={narrow ? "sr-only sm:not-sr-only" : ""}>Plant X Control Tower</span>
          </NavLink>
          <span className="rounded-sm bg-sunken px-2 py-0.5 text-meta font-medium text-ink-2">{ROLE_WORD[role]}</span>
          {NAV[role].length > 0 && (
            <nav aria-label="Main" className="ml-2 hidden items-center gap-1 md:flex">
              {NAV[role].map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-body font-medium ${isActive ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-sunken"}`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-1">
            <StreamIndicator />
            <NotificationBell />
            <span className="hidden px-2 text-meta text-muted lg:inline">{session.user.name}</span>
            <button
              type="button"
              onClick={() => {
                setSession(null);
                qc.clear();
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-meta font-medium text-ink-2 hover:bg-sunken"
            >
              <SignOut size={18} weight="bold" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        {NAV[role].length > 1 && (
          <nav aria-label="Main" className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1 md:hidden">
            {NAV[role].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-2 text-meta font-medium ${isActive ? "bg-accent-soft text-accent" : "text-ink-2"}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      {/* New page fades in; the old one is not held back for an exit animation, so navigation is never delayed. */}
      <motion.main
        key={location.pathname}
        id="main"
        tabIndex={-1}
        className="flex-1 outline-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={fadeIn.transition}
      >
        <Outlet />
      </motion.main>
      <Footer />
    </div>
  );
}

export function Footer({ children }: { children?: ReactNode }) {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-meta text-muted sm:px-6">
        <p>{FICTIONAL_NOTICE}</p>
        {ANY_MOCKS && <p>Serving data from the in-browser mock API.</p>}
        {children}
      </div>
    </footer>
  );
}

/** "Reconnecting" appears only when the live stream is down; data then refreshes every 3 seconds. */
function StreamIndicator() {
  const status = useStreamStatus();
  return (
    <AnimatePresence>
      {status === "reconnecting" && (
        <motion.span
          {...fadeIn}
          role="status"
          className="inline-flex items-center gap-1.5 rounded-sm bg-medium-soft px-2 py-1 text-meta font-semibold text-medium"
        >
          <ArrowsClockwise size={14} weight="bold" aria-hidden />
          Reconnecting
          <span className="sr-only">. Live updates paused; refreshing every 3 seconds.</span>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function Mark() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="6" fill="var(--color-accent)" />
      <path d="M8 21h16M8 21l4-10h8l4 10" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
