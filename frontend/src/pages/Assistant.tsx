import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Bot, MessageSquarePlus, Send, ShieldAlert, Trash2, User as UserIcon, WifiOff } from "lucide-react";
import { api } from "../services/api";
import { useProfile } from "../hooks/useData";
import { useToast } from "../context/ToastContext";
import { Spinner } from "../components/ui";

type Msg = { id: string; role: "user" | "model"; content: string };
const SUGGESTIONS = [
  "How much protein should I consume?",
  "Suggest a healthy breakfast",
  "How many calories should I eat?",
  "Suggest a beginner gym workout",
  "Analyse my weekly fitness progress",
];

/** Minimal, safe markdown: paragraphs, bullet lists and **bold**. No HTML injection. */
function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (/^#{1,4}\s/.test(b)) return <p key={i} className="font-semibold">{inline(b.replace(/^#{1,4}\s/, ""))}</p>;
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(b)}
          </p>
        );
      })}
    </div>
  );
}

export default function Assistant() {
  const qc = useQueryClient();
  const toast = useToast();
  const profile = useProfile();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const list = useQuery({ queryKey: ["conversations"], queryFn: () => api<{ items: Array<{ id: string; title: string }> }>("/ai/conversations") });

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function open(id: string) {
    const r = await api<{ conversation: { id: string; messages: Msg[] } }>(`/ai/conversations/${id}`);
    setConversationId(id);
    setMessages(r.conversation.messages);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: message }]);
    setBusy(true);
    try {
      const r = await api<{ conversationId: string; message: Msg }>("/ai/chat", { method: "POST", json: { conversationId, message } });
      setConversationId(r.conversationId);
      setMessages((m) => [...m, r.message]);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setInput(message);
      toast.show(navigator.onLine ? (e as Error).message : "The AI coach needs an internet connection.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:block">
        <button
          className="btn-ghost mb-3 w-full"
          onClick={() => {
            setConversationId(undefined);
            setMessages([]);
          }}
        >
          <MessageSquarePlus className="size-4" /> New chat
        </button>
        <ul className="space-y-1">
          {(list.data?.items ?? []).map((c) => (
            <li key={c.id} className="group flex items-center">
              <button
                onClick={() => open(c.id)}
                className={clsx("flex-1 truncate rounded-lg px-3 py-2 text-left text-sm", c.id === conversationId ? "bg-green/10 text-green" : "text-ink-2 hover:bg-card")}
              >
                {c.title}
              </button>
              <button
                className="p-1.5 text-ink-3 opacity-0 group-hover:opacity-100 hover:text-danger"
                aria-label="Delete conversation"
                onClick={async () => {
                  await api(`/ai/conversations/${c.id}`, { method: "DELETE" });
                  if (c.id === conversationId) {
                    setConversationId(undefined);
                    setMessages([]);
                  }
                  qc.invalidateQueries({ queryKey: ["conversations"] });
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="card flex h-[calc(100dvh-11rem)] flex-col p-0 lg:h-[calc(100dvh-6rem)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-green/15 text-green">
              <Bot className="size-5" />
            </span>
            <div>
              <div className="font-display font-semibold">FitPulse Coach</div>
              <div className="text-xs text-ink-3">
                {profile.data?.profile?.aiPersonalization ? "Personalised with your profile & progress" : "Personalisation off · change in Settings"}
              </div>
            </div>
          </div>
          <button
            className="btn-ghost px-2.5 py-1.5 text-xs lg:hidden"
            onClick={() => {
              setConversationId(undefined);
              setMessages([]);
            }}
          >
            <MessageSquarePlus className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="grid size-16 place-items-center rounded-3xl bg-green/10 text-green" style={{ boxShadow: "var(--glow)" }}>
                <Bot className="size-8" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">Ask me anything about fitness</h2>
                <p className="text-sm text-ink-2">Nutrition, workouts, recovery, sleep and healthy habits.</p>
              </div>
              <div className="flex max-w-lg flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={clsx("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <span className={clsx("grid size-8 shrink-0 place-items-center rounded-full", m.role === "user" ? "bg-card-2" : "bg-green/15 text-green")}>
                {m.role === "user" ? <UserIcon className="size-4" /> : <Bot className="size-4" />}
              </span>
              <div
                className={clsx(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "user" ? "rounded-tr-sm bg-green text-on-green" : "rounded-tl-sm bg-card-2",
                )}
              >
                {m.role === "user" ? m.content : <Markdown text={m.content} />}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-3 text-sm text-ink-3">
              <Spinner className="size-4" /> Coach is thinking…
            </div>
          )}
          <div ref={bottom} />
        </div>

        <div className="border-t border-line p-3">
          {!navigator.onLine && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-warn">
              <WifiOff className="size-3.5" /> Offline — the coach needs an internet connection.
            </p>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input className="input" placeholder="Ask the coach…" value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} aria-label="Message" />
            <button className="btn-primary shrink-0 px-3" disabled={!input.trim() || busy} aria-label="Send">
              <Send className="size-4" />
            </button>
          </form>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-3">
            <ShieldAlert className="size-3" /> General guidance only, not medical advice. Consult a professional for health conditions.
          </p>
        </div>
      </div>
    </div>
  );
}
