"use client";

import type { MeResponse } from "@untiered/shared";
import type { Route } from "next";
import { useEffect, useId, useRef, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { fetchMe, updateEmailPreferences } from "@/lib/api";
import { forgetReports } from "@/lib/report-cache";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAccessToken } from "@/lib/use-access-token";

type State =
  | { status: "loading" }
  | { status: "ready"; ownerToken: string; me: MeResponse }
  | { status: "error"; ownerToken: string; message: string };

/**
 * The last profile this tab loaded. The account block sits inside every page's shell, so
 * it mounts afresh on each navigation; without this it showed a loading placeholder and
 * asked the API again every time the top navigation was used. Memory only, and cleared on
 * sign-out, so it never outlives the session it belongs to.
 */
let lastMe: MeResponse | null = null;

/** Drops what this tab remembers about the signed-in account. */
export function forgetAccount(): void {
  lastMe = null;
  forgetReports();
}

const LANGUAGE_LABELS: Record<string, string> = {
  english: "English",
  hindi_english: "Hindi-English",
  regional: "Regional",
};

/**
 * Who is signed in, at the foot of the rail, and the account actions behind it.
 *
 * The actions sit in a menu that opens from the name rather than in the rail itself.
 * Signing out is rare and cannot be undone without signing in again, so a control for it
 * sitting permanently in the furniture would be clutter and something to hit by accident;
 * one click behind the name it is neither. Account deletion remains in the profile's
 * dedicated account section, where everything it removes is listed first.
 *
 * Deliberately a client-side call to the versioned public API rather than a
 * server-rendered database read: the mobile apps will make exactly this request, and
 * profile flows must not acquire a server-rendering dependency (PRD 13).
 */
export function AccountSummary() {
  const accessToken = useAccessToken();
  const pathname = usePathname();
  const [state, setState] = useState<State>(() =>
    accessToken && lastMe ? { status: "ready", ownerToken: accessToken, me: lastMe } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const [promptFor, setPromptFor] = useState<string | null>(null);
  const visibleState: State =
    accessToken === null
      ? { status: "error", ownerToken: "", message: "This browser has no active session." }
      : state.status === "error" && state.ownerToken !== accessToken ? { status: "loading" } : state;

  useEffect(() => {
    if (accessToken === null) lastMe = null;
    if (!accessToken) return;
    const operationToken = accessToken;
    const controller = new AbortController();

    async function load() {
      try {
        const me = await fetchMe({ accessToken: operationToken, signal: controller.signal });
        if (!controller.signal.aborted) {
          if (window.sessionStorage.getItem("untiered:email-opt-in-pending") === "1") {
            try {
              await updateEmailPreferences(operationToken, {
                dailyQuestion: true,
                announcements: true,
                reengagement: true,
              });
              window.sessionStorage.removeItem("untiered:email-opt-in-pending");
            } catch {
              // Keep the explicit choice for a retry on the next account load.
            }
          }
          lastMe = me;
          setState({ status: "ready", ownerToken: operationToken, me });
          const isEmpty = !me.profile.function && !me.profile.currentLevel && !me.profile.targetLevel;
          if (isEmpty) {
            try {
              setPromptFor(window.localStorage.getItem(`untiered:profile-setup:${me.id}`) ? null : me.id);
            } catch {
              setPromptFor(me.id);
            }
          } else {
            setPromptFor(null);
          }
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        // A refresh that fails behind a profile already on screen changes nothing the
        // candidate can see; only a first load with nothing to show is an error.
        if (lastMe) {
          setState({ status: "ready", ownerToken: operationToken, me: lastMe });
          return;
        }
        setState({
          status: "error",
          ownerToken: operationToken,
          message: error instanceof Error ? error.message : "Your profile could not be loaded.",
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [accessToken, attempt]);

  function dismissPrompt(id: string) {
    try { window.localStorage.setItem(`untiered:profile-setup:${id}`, "seen"); } catch { /* Storage is optional. */ }
    setPromptFor(null);
  }

  return (
    <div className="relative">
      {visibleState.status === "loading" ? (
        <span role="status" className="grid size-9 animate-pulse place-items-center rounded-full bg-surface-sunken">
          <span className="sr-only">Loading your profile…</span>
        </span>
      ) : visibleState.status === "error" ? (
        <div role="alert" className="flex items-center gap-2 text-caption text-danger">
          <span className="max-w-40 truncate" title={visibleState.message}>{accessToken ? "Account unavailable" : "Sign in needed"}</span>
          <span className="sr-only">{visibleState.message}</span>
          {accessToken ? <button type="button" onClick={() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }} className="font-semibold underline underline-offset-2">Retry</button> : <Link href="/login" className="font-semibold underline underline-offset-2">Sign in</Link>}
        </div>
      ) : (
        <AccountMenu me={visibleState.me} />
      )}
      {visibleState.status === "ready" && promptFor === visibleState.me.id && pathname !== "/profile" ? (
        <section aria-labelledby="profile-setup-title" className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-accent/25 bg-surface-raised p-5 shadow-[var(--shadow-lg)]">
          <p className="eyebrow text-accent">Welcome to Untiered</p>
          <h2 id="profile-setup-title" className="mt-2 text-heading font-bold text-ink">Set up your profile</h2>
          <p className="mt-2 text-caption text-ink-muted">Add your current and target level so your interview practice starts with the right context.</p>
          <div className="mt-4 flex items-center gap-4">
            <Link href="/profile#profile-details" onClick={() => dismissPrompt(visibleState.me.id)} className="rounded-lg bg-accent px-4 py-2 text-caption font-semibold text-accent-contrast hover:bg-accent-strong">Fill in details</Link>
            <button type="button" onClick={() => dismissPrompt(visibleState.me.id)} className="text-caption font-medium text-ink-muted hover:text-ink">Later</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const MENU_ITEM =
  "flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-caption text-ink transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60";

/**
 * A disclosure rather than an ARIA `menu`: it is a short list of links and one button, and
 * a plain list keeps ordinary Tab navigation instead of asking for arrow-key handling.
 * It expands in place, which works the same in the desktop rail and the stacked mobile header.
 */
function AccountMenu({ me }: { me: MeResponse }) {
  const router = useRouter();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const name = me.displayName ?? me.email;

  // Closes on Escape (handing focus back to the name) and on a press anywhere else.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    forgetAccount();
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2.5 rounded-xl px-1 py-2 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full bg-avatar-fill text-caption font-bold text-avatar-ink ring-1 ring-line"
        >
          {initialsOf(name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="hidden max-w-28 truncate text-caption font-semibold text-ink lg:block">{name}</span>
          <span className="hidden truncate text-micro text-ink-subtle lg:block">
            {LANGUAGE_LABELS[me.preferredLanguage] ?? me.preferredLanguage}
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`hidden size-4 shrink-0 fill-none stroke-current stroke-2 text-ink-subtle transition-transform lg:block ${open ? "" : "rotate-180"}`}
        >
          <polyline points="4,10 8,6 12,10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul id={menuId} className="z-overlay absolute top-full right-0 mt-2 flex min-w-56 flex-col gap-0.5 rounded-xl border border-line bg-surface-raised p-1.5 shadow-[var(--shadow-lg)]">
          <li>
            <Link
              href={"/upgrade" as Route}
              className="mb-1 flex min-h-11 w-full items-center justify-between rounded-lg bg-accent-wash px-3 py-2.5 text-left text-caption font-semibold text-accent-strong transition-colors hover:bg-accent hover:text-accent-contrast"
              onClick={() => setOpen(false)}
            >
              Explore Untiered Pro <span aria-hidden>→</span>
            </Link>
          </li>
          <li>
            <Link href="/profile" className={MENU_ITEM} onClick={() => setOpen(false)}>
              Profile and resume
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              aria-busy={signingOut}
              className={MENU_ITEM}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/** Two letters, so the rail has a fixed anchor point whatever the name's length. */
function initialsOf(name: string): string {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : (parts[0]?.slice(0, 2) ?? "");
  return letters.toUpperCase();
}
