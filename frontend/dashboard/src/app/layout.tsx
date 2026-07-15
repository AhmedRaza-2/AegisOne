import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "AegisOne — AI-Powered Phishing Prevention",
  description: "In-house multi-channel phishing detection and prevention platform powered by AI. Protect your organization across email, browser, URLs, and attachments.",
  keywords: ["phishing", "cybersecurity", "AI", "detection", "prevention", "email security"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('aegis_theme');
                if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="bg-surface-50 text-surface-900 dark:bg-surface-950 dark:text-white antialiased min-h-screen transition-colors duration-300">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
