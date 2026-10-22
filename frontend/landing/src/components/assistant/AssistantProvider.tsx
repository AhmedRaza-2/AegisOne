import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { sanitizeContext, type SafeContext } from '../../../../shared-assistant/src/index';
import AssistantWidget from './AssistantWidget';

const PageContext = createContext<(context: SafeContext) => void>(() => {});

/** Mounted by the homepage route only; leaving that route disposes the chatbot. */
export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<SafeContext>({ surface: 'landing', section: 'hero' });
  const publish = useCallback((value: SafeContext) => setContext(sanitizeContext({ ...value, surface: 'landing' })), []);
  return <PageContext.Provider value={publish}>{children}<AssistantWidget context={context} /></PageContext.Provider>;
}

export function useAssistantContext(context: SafeContext) {
  const publish = useContext(PageContext);
  const key = JSON.stringify(sanitizeContext(context));
  const safe = useMemo(() => sanitizeContext(context), [key]);
  useEffect(() => publish(safe), [publish, safe]);
}
