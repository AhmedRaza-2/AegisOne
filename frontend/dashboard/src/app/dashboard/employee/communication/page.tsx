"use client";
import { useAuth } from "@/lib/auth-context";
import { MessageSquare, Megaphone, Users, CheckCircle2, XCircle, Globe } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatView, ContactItem, ChatContact, ChatMessage, roleLabel, ts } from "@/components/chat/ChatComponents";

function Toast({ toast }: { toast: { message: string; type: "success" | "error" } | null }) {
  if (!toast) return null;
  return (
    <motion.div key="t" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
      className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-white font-medium z-[999] text-sm ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
      {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
      {toast.message}
    </motion.div>
  );
}

export default function EmployeeCommunicationPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [announcements, setAnnouncements] = useState<ChatMessage[]>([]);
  const [tab, setTab] = useState<"chat" | "announce">("chat");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getHeaders = useCallback(() => {
    const t = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    return { Authorization: `Bearer ${t || ""}`, "Content-Type": "application/json" };
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load contacts once
  useEffect(() => {
    if (!user) return;
    fetch("http://100.104.105.20:8000/communication/contacts", { headers: getHeaders() })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setContacts(data);
          if (data.length > 0) setActiveContact(data[0]);
        }
      }).catch(console.error);
  }, [user, getHeaders]);

  // Load announcements
  useEffect(() => {
    if (!user) return;
    const load = () =>
      fetch("http://100.104.105.20:8000/communication/announcements", { headers: getHeaders() })
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setAnnouncements(d); }).catch(() => { });
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [user, getHeaders]);

  // Poll active thread every 5s
  useEffect(() => {
    if (!activeContact) return;
    if (pollRef.current) clearInterval(pollRef.current);
    const load = () =>
      fetch(`http://100.104.105.20:8000/communication/conversation/${activeContact.id}`, { headers: getHeaders() })
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setThread(d); }).catch(() => { });
    load();
    pollRef.current = setInterval(load, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeContact, getHeaders]);

  const handleSend = async (text: string) => {
    if (!activeContact) return;
    try {
      const res = await fetch("http://100.104.105.20:8000/communication/send", {
        method: "POST", headers: getHeaders(),
        body: JSON.stringify({ msg_type: "direct", receiver_id: activeContact.id, content: text })
      });
      if (res.ok) {
        const data = await fetch(
          `http://100.104.105.20:8000/communication/conversation/${activeContact.id}`,
          { headers: getHeaders() }
        ).then(r => r.json());
        if (Array.isArray(data)) setThread(data);
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to send", "error");
      }
    } catch { showToast("Network error", "error"); }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-6xl mx-auto">
      <AnimatePresence><Toast toast={toast} /></AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare className="w-6 h-6 text-brand-600 dark:text-brand-400" />
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Communication</h1>
          <p className="text-xs text-surface-500 dark:text-surface-400">Secure messaging with your manager</p>
        </div>
        <div className="ml-auto flex gap-1 p-1 bg-surface-100 dark:bg-surface-900 rounded-lg">
          <button onClick={() => setTab("chat")} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${tab === "chat" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500"}`}>
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
          <button onClick={() => setTab("announce")} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${tab === "announce" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500"}`}>
            <Megaphone className="w-4 h-4" /> Announcements
            {announcements.length > 0 && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-brand-500 text-white rounded-full">{announcements.length}</span>}
          </button>
        </div>
      </div>

      {tab === "chat" ? (
        <div className="flex flex-1 rounded-2xl border border-surface-200 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-[#141A29] shadow-sm min-h-0">
          {/* Contacts sidebar */}
          <div className="w-64 shrink-0 border-r border-surface-200 dark:border-white/[0.06] flex flex-col">
            <div className="px-4 py-2.5 border-b border-surface-200 dark:border-white/[0.06]">
              <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Your Manager</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {contacts.length === 0
                ? <div className="text-center py-12 text-surface-400 text-sm px-4">No contacts found</div>
                : contacts.map(c => (
                  <ContactItem key={c.id} contact={c} isActive={activeContact?.id === c.id} onClick={() => setActiveContact(c)} />
                ))
              }
            </div>
          </div>

          {/* Chat area */}
          {activeContact ? (
            <ChatView
              currentUserId={user.id}
              activeContact={activeContact}
              thread={thread}
              accentColor="brand"
              onSend={handleSend}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-surface-400">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a contact to start chatting</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Announcements */
        <div className="flex-1 rounded-2xl border border-surface-200 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-[#141A29] shadow-sm">
          <div className="p-5 border-b border-surface-200 dark:border-white/[0.06] bg-surface-50/50 dark:bg-white/[0.01]">
            <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-brand-500" /> Department & Organization Announcements
            </h2>
            <p className="text-xs text-surface-500 mt-1">Broadcasts from your manager and organization admins</p>
          </div>
          <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ maxHeight: "calc(100% - 80px)" }}>
            {announcements.length === 0 ? (
              <div className="text-center py-16 text-surface-400">
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No announcements yet</p>
              </div>
            ) : announcements.map(a => (
              <div key={a.id} className="p-4 rounded-xl border border-surface-200 dark:border-white/[0.05] bg-surface-50 dark:bg-surface-950">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {a.msg_type === "org_broadcast" ? <Globe className="w-4 h-4 text-amber-500" /> : <Megaphone className="w-4 h-4 text-brand-500" />}
                    <span className="text-sm font-semibold text-surface-900 dark:text-white">{a.title || (a.msg_type === "org_broadcast" ? "Organization Announcement" : "Department Broadcast")}</span>
                    {a.msg_type === "org_broadcast" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">ORG-WIDE</span>}
                  </div>
                  <span className="text-[10px] text-surface-400 shrink-0 ml-3">{ts(a.created_at)}</span>
                </div>
                <p className="text-sm text-surface-600 dark:text-surface-400">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
