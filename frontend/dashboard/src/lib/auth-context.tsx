"use client";
import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";

export type Role = "employee" | "department_admin" | "manager" | "admin" | "super_admin" | "global_admin";

type AuthContextType = {
  user: any;
  login: (email: string, pass: string, requestedRole?: string) => Promise<{ success: boolean; role?: string; error?: string }>;
  logout: () => void;
  isLoading: boolean;
  theme: string;
  toggleTheme: () => void;
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
      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.detail || "Invalid credentials" };
      }

      const data = await response.json();
      
      if (requestedRole && data.role !== requestedRole) {
         return { success: false, role: data.role, error: `Unauthorized. You are assigned as ${data.role}, but tried to access ${requestedRole}.` };
      }

      const userData = {
        email: email,
        full_name: data.full_name,
        role: data.role,
        department: data.department,
        organization_id: data.organization_id
      };

      // Store in LocalStorage
      localStorage.setItem("aegis_access_token", data.access_token);
      localStorage.setItem("aegis_token", data.access_token);
      localStorage.setItem("aegis_refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(userData));
      
      // Store in Cookies for persistent session across tabs and reloads
      setCookie("aegis_access_token", data.access_token);
      setCookie("aegis_user", JSON.stringify(userData));

      setUser(userData);
      
      return { success: true, role: data.role };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to connect to server" };
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
    <AuthContext.Provider value={{ user, login, logout, isLoading, theme, toggleTheme }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
