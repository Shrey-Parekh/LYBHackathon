import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ChatCircleDots, PaperPlaneRight, X } from "@phosphor-icons/react";
import { useAskAssistant, useAssistantStatus } from "../api/queries";
import type { ChatTurn, Role } from "../api/contract";
import { Button } from "./ui";

/*
  Order-tracking assistant: a chat menu in the top bar, for every role (bonus item, DESIGN.md 2.3).
  Answers come from a language model (Groq) that is given only the shipments this user may see,
  so the panel always says that it is AI and that the screen is the record.
*/
const SUGGESTIONS: Record<Role, string[]> = {
  COORDINATOR: ["Which shipments are at risk of being late?", "Why is SHP-1001 delayed?", "What is on the road right now?"],
  DRIVER: ["What is my ETA?", "Am I running late?", "How far do I have left?"],
  CUSTOMER: ["Where is my order?", "When will it arrive?", "Is my delivery delayed, and why?"],
};
const MAX_QUESTION = 500;
const HISTORY_TURNS = 10; // the API accepts at most 10 earlier turns

export function AssistantChat({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const status = useAssistantStatus(open);
  const ask = useAskAssistant();
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [turns, ask.isPending, open]);

  const unconfigured = status.data?.configured === false;
  const busy = ask.isPending;
  const addAnswer = (r: { answer: string }) => setTurns((t) => [...t, { role: "assistant", content: r.answer }]);

  function send(text: string) {
    const question = text.trim().slice(0, MAX_QUESTION);
    if (!question || busy || unconfigured) return;
    const history = turns.slice(-HISTORY_TURNS);
    setTurns((t) => [...t, { role: "user", content: question }]);
    setDraft("");
    ask.mutate({ question, history }, { onSuccess: addAnswer });
  }

  /** After a failure the question stays in the list; this sends it again without adding it twice. */
  function retry() {
    const last = turns.at(-1);
    if (!last || last.role !== "user" || busy) return;
    ask.mutate({ question: last.content, history: turns.slice(0, -1).slice(-HISTORY_TURNS) }, { onSuccess: addAnswer });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(draft);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Ask the assistant"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-2 hover:bg-sunken"
      >
        <ChatCircleDots size={20} weight="bold" aria-hidden />
      </button>
      {open && (
        <section
          id={panelId}
          aria-label="Assistant"
          className="fixed inset-x-4 top-16 z-[900] flex max-h-[min(560px,calc(100dvh-88px))] flex-col rounded-lg border border-line-strong bg-surface text-ink sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[400px]"
        >
          <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-body font-semibold">Ask about your shipments</h2>
              <p className="text-meta text-muted">AI answers from the shipments you can see. Check the screen before acting.</p>
            </div>
            <button type="button" aria-label="Close assistant" onClick={() => setOpen(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-sunken">
              <X size={16} weight="bold" aria-hidden />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-3" aria-live="polite">
            {unconfigured ? (
              <p className="text-body text-muted">The assistant is switched off. Set GROQ_API_KEY on the API server and restart it.</p>
            ) : turns.length === 0 ? (
              <div className="space-y-2">
                <p className="text-meta text-muted">Try one of these, or type your own question.</p>
                <ul className="space-y-1.5">
                  {SUGGESTIONS[role].map((q) => (
                    <li key={q}>
                      <button type="button" onClick={() => send(q)} className="w-full rounded-md border border-line bg-surface px-3 py-2 text-left text-body text-ink-2 hover:border-line-strong hover:bg-sunken">
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul className="space-y-3">
                {turns.map((t, i) => (
                  <li key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                    <p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-body ${t.role === "user" ? "bg-accent text-on-accent" : "bg-sunken text-ink"}`}>
                      <span className="sr-only">{t.role === "user" ? "You: " : "Assistant: "}</span>
                      {t.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {busy && <p role="status" className="text-meta text-muted">Looking at your shipments…</p>}
            {ask.error && !busy && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-high-soft px-3 py-2 text-meta text-high">
                <span>{ask.error.message}</span>
                <Button size="sm" onClick={retry}>Try again</Button>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-line px-3 py-3">
            <label htmlFor={`${panelId}-q`} className="sr-only">Your question</label>
            <textarea
              id={`${panelId}-q`}
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={MAX_QUESTION}
              disabled={unconfigured}
              placeholder="Type a question"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              className="max-h-28 min-h-10 flex-1 resize-none rounded-md border border-line bg-surface px-3 py-2 text-body text-ink placeholder:text-muted"
            />
            <Button type="submit" variant="primary" aria-label="Send question" disabled={!draft.trim() || busy || unconfigured} className="w-10 px-0">
              <PaperPlaneRight size={18} weight="bold" aria-hidden />
            </Button>
          </form>
          {status.data?.configured && <p className="border-t border-line px-4 py-2 text-meta text-muted">Answers by {status.data.provider} · {status.data.model}</p>}
        </section>
      )}
    </div>
  );
}
