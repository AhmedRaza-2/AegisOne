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
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("aegis_access_token");
    const storedUser = localStorage.getItem("user");
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
    if (typeof document !== 'undefined') {
      const isDark = theme === "light";
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
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

      localStorage.setItem("aegis_access_token", data.access_token);
      localStorage.setItem("aegis_token", data.access_token);
      localStorage.setItem("aegis_refresh_token", data.refresh_token);
      
      const userData = {
        email: email,
        full_name: data.full_name,
        role: data.role,
        department: data.department,
        organization_id: data.organization_id
      };
      
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      
      return { success: true, role: data.role };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to connect to server" };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("aegis_access_token");
    localStorage.removeItem("aegis_refresh_token");
    localStorage.removeItem("user");
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
