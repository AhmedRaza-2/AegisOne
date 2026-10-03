"use client";
import { useAuth } from "@/lib/auth-context";
import { getApiBaseUrl } from "@/lib/api";
import { MessageSquare, Megaphone, Users, Globe } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { ChatView, ContactList, ChatMessage, useChat, ts } from "@/components/chat/ChatComponents";

export default function EmployeeCommunicationPage() {
  const { user } = useAuth();
  const { contacts, active, setActive, thread, send } = useChat(user?.id, "manager");
  const [announcements, setAnnouncements] = useState<ChatMessage[]>([]);
  const [tab, setTab] = useState<"chat" | "announce">("chat");

  const loadAnnouncements = useCallback(() => {
    const t = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
    fetch(`${getApiBaseUrl()}/communication/announcements`, { headers: { Authorization: `Bearer ${t || ""}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setAnnouncements(d); }).catch(() => { });
  }, []);

  useEffect(() => {
    if (!user) return;
    loadAnnouncements();
    const id = setInterval(loadAnnouncements, 15000);
    return () => clearInterval(id);
  }, [user, loadAnnouncements]);

  const unreadTotal = contacts.reduce((n, c) => n + (c.unread_count || 0), 0);

  if (!user) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare className="w-6 h-6 text-brand-600 dark:text-brand-400" />
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Communication</h1>
          <p className="text-xs text-surface-500 dark:text-surface-400">Message your manager or the security admins, and read announcements</p>
        </div>
        <div className="ml-auto flex gap-1 p-1 bg-surface-100 dark:bg-surface-900 rounded-lg">
          <button onClick={() => setTab("chat")} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${tab === "chat" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500"}`}>
            <MessageSquare className="w-4 h-4" /> Chat
            {unreadTotal > 0 && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-brand-500 text-white rounded-full">{unreadTotal}</span>}
          </button>
          <button onClick={() => setTab("announce")} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${tab === "announce" ? "bg-white dark:bg-[#1A2133] text-surface-900 dark:text-white shadow-sm" : "text-surface-500"}`}>
            <Megaphone className="w-4 h-4" /> Announcements
            {announcements.length > 0 && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-surface-400 text-white rounded-full">{announcements.length}</span>}
          </button>
        </div>
      </div>

      {tab === "chat" ? (
        <div className="flex flex-1 rounded-2xl border border-surface-200 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-[#141A29] shadow-sm min-h-0">
          <div className="w-72 shrink-0 border-r border-surface-200 dark:border-white/[0.06] min-h-0">
            <ContactList contacts={contacts} activeId={active?.id} onSelect={setActive} />
          </div>

          {active ? (
            <ChatView currentUserId={user.id} activeContact={active} thread={thread} accentColor="brand" onSend={send} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-surface-400">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select someone to start chatting</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 rounded-2xl border border-surface-200 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-[#141A29] shadow-sm">
          <div className="p-5 border-b border-surface-200 dark:border-white/[0.06] bg-surface-50/50 dark:bg-white/[0.01]">
            <h2 className="text-base font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-brand-500" /> Department &amp; Organization Announcements
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
                <p className="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
