"use client";
import { Send, Check, Search } from "lucide-react";
import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/toast";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ChatContact {
  id: number;
  full_name: string;
  email: string;
  role: string;
  department?: string;
  department_id?: number;
  unread_count?: number;
  last_message_at?: string;
}

export interface ChatMessage {
  id: number;
  sender_id: number;
  receiver_id?: number;
  msg_type: string;
  title?: string;
  content: string;
  created_at: string;
  priority: string;
  is_read: boolean;
}

// ─── Role label ───────────────────────────────────────────────────────────────
export function roleLabel(role: string) {
  const map: Record<string, string> = {
    department_admin: "Dept. Manager", office_admin: "Office Manager",
    manager: "Manager", admin: "Admin", super_admin: "Admin", global_admin: "Global Admin", employee: "Employee",
  };
  return map[role] || role;
}

// ─── Timestamp ───────────────────────────────────────────────────────────────
// The API sends UTC timestamps without a zone marker ("2026-10-02T21:57:44"), which the
// browser reads as local time and shows hours off. Treat them as UTC explicitly.
export function parseServerDate(d: string) {
  if (!d) return new Date(NaN);
  const iso = String(d).replace(" ", "T");
  return new Date(/Z$|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
}

export function ts(d: string) {
  const date = parseServerDate(d);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Tick Component (WhatsApp-style) ─────────────────────────────────────────
function Ticks({ isRead }: { isRead: boolean }) {
  return (
    <span className="inline-flex items-center ml-1">
      {/* First tick */}
      <Check className={`w-3 h-3 -mr-1.5 ${isRead ? "text-sky-300" : "text-white/50"}`} strokeWidth={3} />
      {/* Second tick (double = delivered) */}
      <Check className={`w-3 h-3 ${isRead ? "text-sky-300" : "text-white/50"}`} strokeWidth={3} />
    </span>
  );
}

// ─── Contact Item ─────────────────────────────────────────────────────────────
interface ContactItemProps {
  contact: ChatContact;
  isActive: boolean;
  onClick: () => void;
  accentColor?: string;
}

export function ContactItem({ contact, isActive, onClick, accentColor = "brand" }: ContactItemProps) {
  const activeBg = "bg-[#F0F6FA] dark:bg-white/[0.03] border-l-[#4A7FA7]";
    
  const avatarActive = "bg-[#4A7FA7] text-white";
    
  const avatarInactive = "bg-[#E4EEF6] dark:bg-white/[0.04] text-[#3D6C90] dark:text-[#A9C2D6]";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-50 dark:hover:bg-white/[0.03] transition-colors border-b border-surface-100 dark:border-white/[0.03]
        ${isActive ? `${activeBg} border-l-2` : ""}`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${isActive ? avatarActive : avatarInactive}`}>
        {contact.full_name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{contact.full_name}</p>
        <p className="text-[10px] text-surface-500 truncate">
          {roleLabel(contact.role)}{contact.department ? ` · ${contact.department}` : ""}
        </p>
      </div>
      {contact.unread_count && contact.unread_count > 0 ? (
        <div className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
          {contact.unread_count > 9 ? "9+" : contact.unread_count}
        </div>
      ) : null}
    </button>
  );
}

// ─── Shared data hook: contacts + active thread, both kept fresh ─────────────
function authHeaders(): Record<string, string> {
  const t = typeof window !== "undefined" ? (localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token")) : null;
  return { Authorization: `Bearer ${t || ""}`, "Content-Type": "application/json" };
}

export function useChat(userId: number | undefined, preferRole?: string) {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [active, setActiveState] = useState<ChatContact | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const activeId = useRef<number | null>(null);

  const setActive = useCallback((c: ChatContact | null) => {
    activeId.current = c ? c.id : null;
    setThread([]);
    setActiveState(c);
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBaseUrl()}/communication/contacts`, { headers: authHeaders() });
      const data = r.ok ? await r.json() : null;
      if (!Array.isArray(data)) return;
      const merged = data.map((c: ChatContact) => (c.id === activeId.current ? { ...c, unread_count: 0 } : c));
      setContacts(merged);
      setLoaded(true);
      if (activeId.current === null && merged.length) {
        const pick = merged.find((c: ChatContact) => (c.unread_count || 0) > 0)
          || (preferRole ? merged.find((c: ChatContact) => c.role === preferRole) : null)
          || merged[0];
        setActive(pick);
      }
    } catch { /* keep the last good list */ }
  }, [preferRole, setActive]);

  const loadThread = useCallback(async () => {
    const id = activeId.current;
    if (id === null) return;
    try {
      const r = await fetch(`${getApiBaseUrl()}/communication/conversation/${id}`, { headers: authHeaders() });
      const data = r.ok ? await r.json() : null;
      if (Array.isArray(data) && activeId.current === id) setThread(data);
    } catch { /* next poll retries */ }
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadContacts();
    const t = setInterval(() => { if (!document.hidden) loadContacts(); }, 8000);
    return () => clearInterval(t);
  }, [userId, loadContacts]);

  useEffect(() => {
    if (!active) return;
    loadThread();
    const t = setInterval(() => { if (!document.hidden) loadThread(); }, 4000);
    return () => clearInterval(t);
  }, [active, loadThread]);

  // Resolves true when the message was accepted, so the input can keep the draft on failure.
  const send = useCallback(async (text: string): Promise<boolean> => {
    const id = activeId.current;
    if (id === null || !userId) return false;
    const temp: ChatMessage = {
      id: -Date.now(), sender_id: userId, receiver_id: id, msg_type: "direct",
      content: text, created_at: new Date().toISOString(), priority: "Normal", is_read: false,
    };
    setThread(prev => [...prev, temp]);
    try {
      const res = await fetch(`${getApiBaseUrl()}/communication/send`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ msg_type: "direct", receiver_id: id, content: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setThread(prev => prev.filter(m => m.id !== temp.id));
        toast(typeof err.detail === "string" ? err.detail : "Message could not be sent.", "error");
        return false;
      }
      await loadThread();
      return true;
    } catch {
      setThread(prev => prev.filter(m => m.id !== temp.id));
      toast("Network error: your message was not sent.", "error");
      return false;
    }
  }, [userId, loadThread]);

  return { contacts, active, setActive, thread, send, loaded };
}

// ─── Contact list with search and role groups ────────────────────────────────
export function ContactList({ contacts, activeId, onSelect }: {
  contacts: ChatContact[]; activeId?: number; onSelect: (c: ChatContact) => void;
}) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = contacts.filter(c => !needle || c.full_name.toLowerCase().includes(needle) || (c.department || "").toLowerCase().includes(needle));
    const when = (c: ChatContact) => new Date(c.last_message_at || 0).getTime();
    const sorted = [...list].sort((a, b) => (b.unread_count || 0) - (a.unread_count || 0) || when(b) - when(a) || a.full_name.localeCompare(b.full_name));
    const g: Record<string, ChatContact[]> = { Managers: [], Admins: [], Colleagues: [] };
    sorted.forEach(c => {
      if (["manager", "department_admin", "office_admin"].includes(c.role)) g.Managers.push(c);
      else if (["admin", "super_admin", "global_admin"].includes(c.role)) g.Admins.push(c);
      else g.Colleagues.push(c);
    });
    return Object.entries(g).filter(([, v]) => v.length);
  }, [contacts, q]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-surface-200 dark:border-white/[0.06]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search people…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-surface-100 dark:bg-white/[0.05] border border-transparent focus:border-brand-500 outline-none text-surface-900 dark:text-white placeholder:text-surface-400" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {groups.length === 0 ? (
          <div className="text-center py-12 text-surface-400 text-sm px-4">{contacts.length ? "No one matches your search" : "No contacts yet"}</div>
        ) : groups.map(([name, items]) => (
          <div key={name}>
            <div className="px-4 py-1.5 bg-surface-50 dark:bg-white/[0.02] sticky top-0 z-10">
              <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">{name} · {items.length}</span>
            </div>
            {items.map(c => <ContactItem key={c.id} contact={c} isActive={activeId === c.id} onClick={() => onSelect(c)} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chat View ─────────────────────────────────────────────────────────────────
interface ChatViewProps {
  currentUserId: number;
  activeContact: ChatContact;
  thread: ChatMessage[];
  accentColor?: "brand" | "amber";
  onSend: (text: string) => Promise<boolean | void>;
}

export function ChatView({ currentUserId, activeContact, thread, accentColor = "brand", onSend }: ChatViewProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length, thread[thread.length - 1]?.id]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await onSend(text.trim());
    if (ok !== false) setText("");
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Chat Header */}
      <div className="px-5 py-3 border-b border-surface-200 dark:border-white/[0.06] flex items-center gap-3 bg-[#F6FAFD] dark:bg-white/[0.01] shrink-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-[#E4EEF6] dark:bg-white/[0.04] text-[#3D6C90] dark:text-[#A9C2D6]`}>
          {activeContact.full_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#0A1931] dark:text-white">{activeContact.full_name}</p>
          <p className="text-[10px] text-emerald-500 font-medium">
            {roleLabel(activeContact.role)}
            {activeContact.department ? <span className="text-surface-400"> · {activeContact.department}</span> : null}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar bg-surface-50/30 dark:bg-transparent">
        {thread.length === 0 && (
          <div className="text-center py-16 text-surface-400">
            <div className="w-16 h-16 rounded-full bg-surface-100 dark:bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">👋</span>
            </div>
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        )}
        {thread.map((m, i) => {
          // Compare as numbers — coerce both sides
          const isMine = Number(m.sender_id) === Number(currentUserId);
          const showDate = i === 0 || parseServerDate(thread[i-1].created_at).toDateString() !== parseServerDate(m.created_at).toDateString();
          return (
            <div key={m.id}>
              {showDate && (
                <div className="flex items-center justify-center my-3">
                  <span className="text-[10px] bg-surface-200 dark:bg-white/[0.08] text-surface-500 px-3 py-1 rounded-full">
                    {parseServerDate(m.created_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                </div>
              )}
              <div className={`flex flex-col max-w-[75%] ${isMine ? "items-end ml-auto" : "items-start mr-auto"}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-[13px] shadow-sm whitespace-pre-wrap
                  ${isMine 
                    ? "bg-emerald-600 text-white rounded-br-sm" 
                    : "bg-surface-200 dark:bg-surface-800 text-surface-900 dark:text-white rounded-bl-sm border border-surface-300 dark:border-white/[0.05]"
                  }`}>
                  <p className="break-words leading-relaxed">{m.content}</p>
                  <div className={`flex items-center gap-0.5 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                    <span className={`text-[10px] ${isMine ? "text-white/60" : "text-surface-400"}`}>
                      {ts(m.created_at)}
                    </span>
                    {isMine && <Ticks isRead={m.is_read} />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-surface-200 dark:border-white/[0.06] flex items-end gap-2 shrink-0 bg-white dark:bg-[#141A29]">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={`Message ${activeContact.full_name}…`}
          className="flex-1 bg-surface-100 dark:bg-white/[0.06] border border-surface-200 dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:border-brand-500 resize-none transition-colors leading-relaxed"
          style={{ maxHeight: 120 }}
          onInput={e => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = "auto";
            t.style.height = Math.min(t.scrollHeight, 120) + "px";
          }}
        />
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className={`w-10 h-10 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center shrink-0 transition-colors bg-[#4A7FA7] hover:bg-[#3D6C90]`}
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
}
