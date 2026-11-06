import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
// Secondary routes load on demand so the landing page ships a much smaller first bundle.
const RegisterPage = lazy(() => import('./pages/RegisterPage.tsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.tsx'));
const PortalPage = lazy(() => import('./pages/PortalPage.tsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.tsx'));
const UpdatePasswordPage = lazy(() => import('./pages/UpdatePasswordPage.tsx'));
const DocsPage = lazy(() => import('./pages/DocsPage.tsx'));
import { AssistantProvider } from './components/assistant/AssistantProvider';
import './index.css';

console.log("main.tsx: Script started executing");

try {
  const rootEl = document.getElementById('root');
  console.log("main.tsx: Root element found:", rootEl);
  
  if (!rootEl) {
    throw new Error("Target container 'root' not found in DOM");
  }

  const root = createRoot(rootEl);
  console.log("main.tsx: createRoot initialized");

  root.render(
    <StrictMode>
      <BrowserRouter>
        <Suspense fallback={<div role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#4A6D8C', fontFamily: 'Outfit, sans-serif' }}>Loading…</div>}>
        <Routes>
          <Route path="/"         element={<AssistantProvider><App /></AssistantProvider>} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/portal"   element={<PortalPage />} />
          <Route path="/admin"    element={<AdminDashboard />} />
          <Route path="/update-password" element={<UpdatePasswordPage />} />
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </StrictMode>,
  );
  console.log("main.tsx: React render triggered");
} catch (error) {
  console.error("main.tsx: Critical error during startup/render:", error);
}

