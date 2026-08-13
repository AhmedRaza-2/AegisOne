"use client";
import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "./api";

export type Role = "employee" | "department_admin" | "manager" | "admin" | "super_admin" | "global_admin";

type AuthContextType = {
  user: any;
  login: (email: string, pass: string, requestedRole?: string) => Promise<{ success: boolean; role?: string; error?: string }>;
  logout: () => void;
  isLoading: boolean;
  theme: string;
  toggleTheme: () => void;
  fetchWithCache: (url: string, init?: RequestInit, ttlMs?: number) => Promise<any>;
  invalidateCache: (urlPrefix?: string) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState("dark");
  const cacheRef = React.useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const router = useRouter();

  // Helper to set cookie
  const setCookie = (name: string, value: string, days = 7) => {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  };

  // Helper to get cookie
  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '');
    return null;
  };

  // Helper to erase cookie
  const eraseCookie = (name: string) => {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; Max-Age=-99999999; path=/;`;
  };

  // Clear client cache (e.g. after database setup execution)
  const invalidateCache = (urlPrefix?: string) => {
    if (!urlPrefix) {
      cacheRef.current.clear();
      return;
    }
    for (const key of cacheRef.current.keys()) {
      if (key.includes(urlPrefix)) {
        cacheRef.current.delete(key);
      }
    }
  };

  // Client-side SWR Cache Helper (Deduplicates & accelerates page navigation)
  const fetchWithCache = async (url: string, init?: RequestInit, ttlMs = 15000) => {
    const cached = cacheRef.current.get(url);
    const now = Date.now();
    if (cached && (now - cached.timestamp < ttlMs)) {
      return cached.data;
    }
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error(`Fetch error: ${res.status}`);
    }
    const data = await res.json();
    cacheRef.current.set(url, { data, timestamp: now });
    return data;
  };

  useEffect(() => {
    // 1. Restore Auth State from Cookies / LocalStorage
    const token = getCookie("aegis_access_token") || localStorage.getItem("aegis_access_token");
    const storedUserStr = getCookie("aegis_user") || localStorage.getItem("user");

    if (token && storedUserStr) {
      try {
        const parsedUser = JSON.parse(storedUserStr);
        setUser(parsedUser);
        // Guarantee synchronization across both storage mechanisms
        localStorage.setItem("aegis_access_token", token);
        localStorage.setItem("user", JSON.stringify(parsedUser));
        setCookie("aegis_access_token", token);
        setCookie("aegis_user", JSON.stringify(parsedUser));
      } catch (e) {
        console.error("[AuthProvider] Error parsing session:", e);
      }
    }

    // 2. Restore Theme Preference
    const savedTheme = localStorage.getItem("aegis_theme") || "dark";
    setTheme(savedTheme);
    if (typeof document !== 'undefined') {
      if (savedTheme === "dark") {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    setIsLoading(false);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("aegis_theme", next);
      if (typeof document !== 'undefined') {
        if (next === "dark") {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      return next;
    });
  };

  const login = async (email: string, pass: string, requestedRole?: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.detail || "Invalid credentials" };
      }
      const token = data.access_token;
      const userRole = data.role || requestedRole || "employee";
      const loggedUser = {
        email: email,
        full_name: data.full_name || email.split("@")[0],
        role: userRole,
        department: data.department || "General",
        organization_id: data.organization_id || "org_default"
      };
      setUser(loggedUser);
      localStorage.setItem("aegis_access_token", token);
      localStorage.setItem("user", JSON.stringify(loggedUser));
      setCookie("aegis_access_token", token);
      setCookie("aegis_user", JSON.stringify(loggedUser));
      return { success: true, role: userRole };
    } catch (e) {
      return { success: false, error: "Network error logging in" };
    }
  };

  const logout = () => {
    setUser(null);
    cacheRef.current.clear();
    // Clear LocalStorage
    localStorage.removeItem("aegis_access_token");
    localStorage.removeItem("aegis_token");
    localStorage.removeItem("aegis_refresh_token");
    localStorage.removeItem("user");
    // Clear Cookies
    eraseCookie("aegis_access_token");
    eraseCookie("aegis_user");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, theme, toggleTheme, fetchWithCache, invalidateCache }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

