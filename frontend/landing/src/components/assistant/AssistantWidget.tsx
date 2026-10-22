import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, ArrowUp, ArrowUpRight, ShieldCheck, Square, Mic, Volume2, RotateCcw } from 'lucide-react';
import {
  createAssistantClient, sanitizeContext, getHint, getFallbackReply, SOURCE_LINKS,
  STARTER_PROMPTS, inferLanguage, createVoiceController, newId, AssistantError,
  type SafeContext, type AssistantAction, type AssistantReply, type Language,
} from '../../../../shared-assistant/src/index';
import './assistant.css';

const config = {
  enabled: import.meta.env.VITE_ASSISTANT_ENABLED === 'true'
    || (import.meta.env.DEV && import.meta.env.VITE_ASSISTANT_ENABLED === undefined),
  voiceEnabled: import.meta.env.VITE_ASSISTANT_VOICE_ENABLED === 'true',
  apiUrl: import.meta.env.VITE_ASSISTANT_API_URL || (import.meta.env.DEV && import.meta.env.VITE_ASSISTANT_LOCAL_API === 'true' && typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) ? `${window.location.origin}/api/assistant` : ''),
};

const words = {
  en: {
    title: 'AegisOne Assistant', subtitle: 'Product & setup support', open: 'Ask AegisOne', close: 'Close assistant', reset: 'New chat',
    eyebrow: 'HERE TO HELP', heading: 'How can I help?', intro: 'Understand your protection, find the right plan, or get your team set up.',
    privacy: 'Privacy & data', disclosure: 'Messages and basic setup status are processed by our AI provider, Groq. Passwords, keys and form values are never attached automatically. Keep private information out of chat.',
    footer: 'AI can make mistakes. Check important details.', offline: 'Live AI is unavailable here. You can still explore the product guides.',
    placeholder: 'Ask about AegisOne…', send: 'Send question', thinking: 'Preparing your answer…', cancel: 'Stop', retry: 'Retry',
    you: 'You', assistant: 'AegisOne', fallback: 'Quick guide', help: 'Helpful', unhelp: 'Not helpful', thanks: 'Thanks for your feedback.',
    listen: 'Listen', mic: 'Record question', stopMic: 'Finish recording', recording: 'Recording. Finish when you are ready.', transcribing: 'Transcribing your recording…',
    speaking: 'Reading aloud…', voiceDisclosure: 'Recording starts only when you choose the microphone. Audio is sent to Groq for transcription; you can review the text before sending. Playback uses browser or basic synthetic voices.',
    hintAsk: 'Help me with this', hintDismiss: 'Dismiss hint', clear: 'Chat cleared.',
    error: 'AI is temporarily unavailable. Try again or use the quick guides.', sources: 'Sources', voiceUnavailable: 'Microphone recording requires HTTPS or localhost. You can continue with text.',
  },
  ur: {
    title: 'AegisOne معاون', subtitle: 'پروڈکٹ اور سیٹ اپ میں مدد', open: 'AegisOne سے پوچھیں', close: 'معاون بند کریں', reset: 'نئی گفتگو',
    eyebrow: 'آپ کی مدد کے لیے', heading: 'میں کیسے مدد کروں؟', intro: 'حفاظت کے بارے میں جانیں، مناسب پلان چنیں یا اپنی ٹیم کا سیٹ اپ مکمل کریں۔',
    privacy: 'رازداری اور معلومات', disclosure: 'آپ کے پیغامات اور سیٹ اپ کی بنیادی حالت ہمارے AI فراہم کنندہ Groq کو بھیجی جاتی ہے۔ پاس ورڈ، کیز اور فارم کی اصل معلومات خود بخود شامل نہیں ہوتیں۔ نجی معلومات چیٹ میں نہ لکھیں۔',
    footer: 'AI سے غلطی ممکن ہے۔ اہم معلومات کی تصدیق کریں۔', offline: 'یہاں لائیو AI دستیاب نہیں۔ پروڈکٹ کی رہنمائی اب بھی دستیاب ہے۔',
    placeholder: 'AegisOne کے بارے میں پوچھیں…', send: 'سوال بھیجیں', thinking: 'جواب تیار ہو رہا ہے…', cancel: 'روکیں', retry: 'دوبارہ کوشش',
    you: 'آپ', assistant: 'AegisOne', fallback: 'مختصر رہنمائی', help: 'مفید', unhelp: 'مفید نہیں', thanks: 'آپ کی رائے کا شکریہ۔',
    listen: 'سنیں', mic: 'سوال ریکارڈ کریں', stopMic: 'ریکارڈنگ مکمل کریں', recording: 'ریکارڈنگ جاری ہے۔ تیار ہونے پر مکمل کریں۔', transcribing: 'آواز کو متن میں بدلا جا رہا ہے…',
    speaking: 'جواب پڑھا جا رہا ہے…', voiceDisclosure: 'ریکارڈنگ صرف مائیک دبانے پر شروع ہوتی ہے۔ آواز کو متن میں بدلنے کے لیے Groq کو بھیجا جاتا ہے۔ سوال بھیجنے سے پہلے متن کا جائزہ لے سکتے ہیں۔ جواب براؤزر یا بنیادی مصنوعی آواز میں پڑھا جاتا ہے۔',
    hintAsk: 'اس میں میری مدد کریں', hintDismiss: 'اشارہ بند کریں', clear: 'گفتگو صاف کر دی گئی۔',
    error: 'AI فی الحال دستیاب نہیں۔ دوبارہ کوشش کریں یا مختصر رہنمائی استعمال کریں۔', sources: 'ذرائع', voiceUnavailable: 'مائیک کی ریکارڈنگ کے لیے HTTPS یا localhost درکار ہے۔ آپ متن سے گفتگو جاری رکھ سکتے ہیں۔',
  },
  'ur-Latn': {
    title: 'AegisOne Assistant', subtitle: 'Product aur setup mein madad', open: 'AegisOne se poochain', close: 'Assistant band karein', reset: 'Nayi chat',
    eyebrow: 'AAP KI MADAD KE LIYE', heading: 'Main kaise madad karun?', intro: 'Protection samjhein, sahi plan chunein, ya apni team ka setup mukammal karein.',
    privacy: 'Privacy aur data', disclosure: 'Aap ke paigham aur bunyadi setup status hamaray AI provider Groq ko bhejay jatay hain. Passwords, keys aur form ki asal values khud shamil nahi hotin. Private maloomat chat mein na likhein.',
    footer: 'AI se ghalti mumkin hai. Aham maloomat check karein.', offline: 'Yahan live AI dastiyab nahi. Product guides ab bhi istemal kar sakte hain.',
    placeholder: 'AegisOne ke baray mein poochain…', send: 'Sawal bhejein', thinking: 'Jawab tayyar ho raha hai…', cancel: 'Rokein', retry: 'Dobara koshish',
    you: 'Aap', assistant: 'AegisOne', fallback: 'Mukhtasar guide', help: 'Madadgar', unhelp: 'Madadgar nahi', thanks: 'Aap ki raye ka shukriya.',
    listen: 'Sunein', mic: 'Sawal record karein', stopMic: 'Recording mukammal karein', recording: 'Recording jari hai. Tayyar hon to mukammal karein.', transcribing: 'Awaz ko text mein badla ja raha hai…',
    speaking: 'Jawab parha ja raha hai…', voiceDisclosure: 'Recording sirf mic dabane par shuru hoti hai. Audio transcription ke liye Groq ko jata hai; sawal bhejne se pehle text dekh sakte hain. Jawab browser ya bunyadi synthetic awaz mein parha jata hai.',
    hintAsk: 'Is mein madad karein', hintDismiss: 'Hint band karein', clear: 'Chat saaf kar di gayi.',
    error: 'AI filhal dastiyab nahi. Dobara koshish karein ya guides istemal karein.', sources: 'Zaraye', voiceUnavailable: 'Mic recording ke liye HTTPS ya localhost zaroori hai. Aap text se baat jari rakh sakte hain.',
  },
};

type ChatItem = { id: string; role: 'user' | 'assistant'; text: string; reply?: AssistantReply };
export interface AssistantWidgetProps { context: SafeContext; onAction?: (action: AssistantAction) => void; busy?: boolean; visible?: boolean }

export default function AssistantWidget(props: AssistantWidgetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return config.enabled && mounted ? <AssistantPanel {...props} /> : null;
}

function AssistantPanel({ context, onAction, busy = false, visible = true }: AssistantWidgetProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [pending, setPending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const resetInProgress = useRef(false);
  const [retryAt, setRetryAt] = useState(0);
  const [error, setError] = useState('');
  const [errorHasGuide, setErrorHasGuide] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing' | 'speaking'>('idle');
  const [hint, setHint] = useState<ReturnType<typeof getHint>>(null);
  const lastHint = useRef(0);
  const dismissedHints = useRef(new Set<string>());
  const abort = useRef<AbortController | null>(null);
  const lastPrompt = useRef('');
  const lastRequest = useRef<{ message: string; language: Language; context: SafeContext; turnId: string } | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const t = words[language];
  const safe = sanitizeContext(context);
  const contextKey = JSON.stringify(safe);
  const client = useMemo(() => {
    let storage: Storage | undefined;
    try { storage = window.sessionStorage; } catch { /* browser storage may be disabled */ }
    return createAssistantClient({ baseUrl: config.apiUrl, storage, storageKey: 'aegisone-assistant' });
  }, []);
  const voice = useRef<ReturnType<typeof createVoiceController> | null>(null);
  useEffect(() => {
    voice.current = createVoiceController({ client, onState: setVoiceState, onTranscript: text => { setInput(text); composer.current?.focus(); }, onError: setError });
    return () => { abort.current?.abort(); voice.current?.dispose(); voice.current = null; };
  }, [client]);
  useEffect(() => {
    if (visible) return;
    setOpen(false); setHint(null); voice.current?.cancel();
  }, [visible]);
  useEffect(() => {
    if (open) { wasOpen.current = true; composer.current?.focus({ preventScroll: true }); }
    else if (wasOpen.current) { wasOpen.current = false; launcher.current?.focus(); }
  }, [open]);
  useEffect(() => { if (open && body.current) body.current.scrollTop = messages.length > 0 || pending ? body.current.scrollHeight : 0; }, [messages, pending, open]);
  useEffect(() => {
    const field = composer.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 120)}px`;
  }, [input, open]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setTimeout(() => setRetryAt(0), Math.max(0, retryAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [retryAt]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); voice.current?.cancel(); launcher.current?.focus(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open, voice]);

  useEffect(() => {
    setHint(null);
    if (open || busy || !visible || document.querySelector('[aria-modal="true"],dialog[open]')) return;
    const candidate = getHint(sanitizeContext(context), language);
    if (!candidate || dismissedHints.current.has(candidate.id)) return;
    const timer = window.setTimeout(() => {
      if (Date.now() - lastHint.current < 90_000 || document.visibilityState !== 'visible' || document.querySelector('[aria-modal="true"],dialog[open]')) return;
      const editing = document.activeElement;
      if (editing instanceof HTMLInputElement || editing instanceof HTMLTextAreaElement || editing instanceof HTMLSelectElement) return;
      setHint(candidate);
      lastHint.current = Date.now();
    }, Math.max(12_000, 90_000 - (Date.now() - lastHint.current)));
    return () => window.clearTimeout(timer);
  }, [contextKey, language, open, busy, visible]);

  const submit = useCallback(async (question: string, retry = false) => {
    const nextLanguage = inferLanguage(question, language);
    const request = retry && lastRequest.current ? lastRequest.current : { message: question.trim(), language: nextLanguage, context: sanitizeContext(context), turnId: newId() };
    const message = request.message;
    const history = messages.filter(item => item.role === 'user').map(item => item.text);
    // A retry reuses the latest user turn, rather than treating it as history.
    if (retry && history.at(-1) === message) history.pop();
    if (!message || resetInProgress.current) return;
    if (abort.current) return;
    voice.current?.cancel();
    setLanguage(request.language);
    setError(''); setErrorHasGuide(false); setAnnouncement(''); setInput(''); setHint(null);
    if (!retry) setMessages(items => [...items, { id: `user-${Date.now()}`, role: 'user', text: message }]);
    lastPrompt.current = message;
    lastRequest.current = request;
    const controller = new AbortController();
    abort.current = controller;
    setPending(true);
    try {
      const cloudRequested = Boolean(config.apiUrl);
      const received = cloudRequested
        ? await client.send(request, { signal: controller.signal })
        : getFallbackReply(message, request.language, request.context, history);
      const reply = cloudRequested && received.status === 'fallback'
        ? { ...getFallbackReply(message, request.language, request.context, history), turnId: received.turnId }
        : received;
      if (!controller.signal.aborted) {
        setLanguage(reply.language);
        if (cloudRequested && received.status === 'fallback') {
          setError(words[request.language].error); setErrorHasGuide(true);
          lastRequest.current = { ...request, turnId: newId() };
        }
        setMessages(items => [...items, { id: reply.turnId, role: 'assistant', text: reply.answer, reply }]);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        if (cause instanceof AssistantError && cause.retryAfter && cause.retryAfter > 0) setRetryAt(Date.now() + Math.min(cause.retryAfter, 86_400) * 1000);
        setError(cause instanceof AssistantError && cause.code === 'limit_reached'
          ? request.language === 'ur' ? 'مفت AI کی گنجائش فی الحال مکمل ہے۔ مختصر رہنمائی استعمال کریں یا بعد میں کوشش کریں۔' : request.language === 'ur-Latn' ? 'Free AI capacity filhal poori hai. Mukhtasar guide istemal karein ya baad mein koshish karein.' : 'Free AI capacity is temporarily used up. Use a quick guide or retry later.'
          : words[request.language].error);
      }
    } finally {
      if (abort.current === controller) { setPending(false); abort.current = null; }
    }
  }, [language, contextKey, client, messages]);

  async function reset() {
    if (resetInProgress.current) return;
    resetInProgress.current = true; setResetting(true);
    abort.current?.abort(); abort.current = null; setPending(false);
    voice.current?.cancel();
    try {
      await client.reset();
      setMessages([]); setInput(''); setLanguage('en'); setError(''); setErrorHasGuide(false); setAnnouncement(t.clear); setRetryAt(0); lastRequest.current = null; lastPrompt.current = '';
    }
    catch { setError(t.error); return; }
    finally { resetInProgress.current = false; setResetting(false); }
    composer.current?.focus();
  }
  function stop() {
    const active = abort.current;
    abort.current = null; active?.abort(); setPending(false);
    setError(language === 'ur' ? 'درخواست روک دی گئی۔' : language === 'ur-Latn' ? 'Darkhwast rok di gayi.' : 'Request stopped.');
  }
  function close() { setOpen(false); voice.current?.cancel(); launcher.current?.focus(); }
  function mic() {
    setError('');
    if (!window.isSecureContext) { setError(t.voiceUnavailable); return; }
    if (voiceState === 'recording') void voice.current?.stopRecording();
    else if (voiceState === 'transcribing') voice.current?.cancel();
    else void voice.current?.start(language);
  }
  function listen(reply: AssistantReply) {
    setError('');
    if (voiceState === 'speaking') { voice.current?.cancel(); return; }
    void voice.current?.speak(reply.speechText, reply.language);
  }
  function act(action: AssistantAction) {
    if (action.type === 'contact_team') { navigate('/#contact'); document.getElementById('contact')?.scrollIntoView({ block: 'start' }); return; }
    if (action.type === 'open_documentation') {
      const link = SOURCE_LINKS[action.target];
      if (link?.path?.startsWith('/') && !link.path.startsWith('//')) navigate(link.path);
      return;
    }
    onAction?.(action);
  }
  const voiceStatus = voiceState === 'recording' ? t.recording : voiceState === 'transcribing' ? t.transcribing : voiceState === 'speaking' ? t.speaking : '';

  if (!visible) return null;
  return <div className="a1-assistant" dir={language === 'ur' ? 'rtl' : 'ltr'} lang={language === 'ur-Latn' ? 'ur-Latn' : language}>
    <div className="a1-sr-only" role="status" aria-live="polite">{announcement}</div>
    {!open && hint && <aside className="a1-hint" aria-label={t.title}>
      <button className="a1-icon-button" aria-label={t.hintDismiss} onClick={() => { dismissedHints.current.add(hint.id); setHint(null); }}><X size={15} /></button>
      <p>{hint.text}</p><button className="a1-link-button" onClick={() => { setOpen(true); setInput(hint.prompt); dismissedHints.current.add(hint.id); setHint(null); }}>{t.hintAsk}</button>
    </aside>}
    {!open && <button ref={launcher} className="a1-launcher" aria-haspopup="dialog" aria-expanded={false} onClick={() => { setOpen(true); setHint(null); }}><MessageCircle size={20} />{t.open}</button>}
    {open && <section className="a1-panel" role="dialog" aria-modal="false" aria-labelledby="a1-assistant-title">
      <header className="a1-header">
        <span className="a1-brand-icon" aria-hidden="true"><ShieldCheck size={22} /></span>
        <div className="a1-header-copy"><h2 id="a1-assistant-title" className="a1-title">{t.title}</h2><p className="a1-subtitle">{t.subtitle}</p></div>
        <div className="a1-header-actions">
          {messages.length > 0 && <button type="button" className="a1-icon-button" aria-label={t.reset} title={t.reset} disabled={pending || resetting} onClick={() => void reset()}><RotateCcw size={17} /></button>}
          <button type="button" className="a1-icon-button" aria-label={t.close} title={t.close} onClick={close}><X size={20} /></button>
        </div>
      </header>
      <div className={`a1-body${messages.length === 0 ? ' a1-body-welcome' : ''}`} ref={body}>
        {messages.length === 0 && <>
          <div className="a1-intro"><span className="a1-welcome-icon" aria-hidden="true"><ShieldCheck size={30} /></span><span className="a1-eyebrow">{t.eyebrow}</span><h3>{t.heading}</h3><p>{t.intro}</p></div>
          <div className="a1-chips">{STARTER_PROMPTS[language].map(prompt => <button type="button" className="a1-chip" key={prompt} disabled={pending} onClick={() => void submit(prompt)}>{prompt}<ArrowUpRight size={15} aria-hidden="true" /></button>)}</div>
        </>}
        {!config.apiUrl && messages.length === 0 && <p className="a1-guide-notice">{t.offline}</p>}
        <div role="log" aria-label={t.title} aria-live="polite" aria-relevant="additions text">
          {messages.map(item => <article key={item.id} className={`a1-message a1-message-${item.role}`}>
            <div className="a1-message-label">{item.role === 'user' ? t.you : item.reply?.status === 'fallback' ? `${t.assistant} · ${t.fallback}` : t.assistant}</div>
            <div className="a1-message-text" dir="auto">{item.text}</div>
            {!!item.reply?.sources.length && <nav className="a1-sources" aria-label={t.sources}>{item.reply.sources.map(id => { const source = SOURCE_LINKS[id]; return source?.path?.startsWith('/') && !source.path.startsWith('//') ? <button type="button" className="a1-link-button" key={id} onClick={() => act({ type: 'open_documentation', target: id })}>{source.title}</button> : null; })}</nav>}
            {item.reply && <div className="a1-message-actions">
              {item.reply.actions.filter(action => action.type !== 'open_documentation' || !item.reply!.sources.includes(action.target)).map((action, index) => <button type="button" key={`${action.type}-${action.target}-${index}`} className="a1-chip" disabled={busy} onClick={() => act(action)}>{actionLabel(action, language)}</button>)}
              {config.voiceEnabled && config.apiUrl && <button type="button" className="a1-icon-button" aria-label={t.listen} title={t.listen} onClick={() => listen(item.reply!)}><Volume2 size={15} /></button>}
            </div>}
          </article>)}
        </div>
        {pending && <p className="a1-status" role="status"><span className="a1-thinking-dots" aria-hidden="true"><i /><i /><i /></span>{t.thinking}</p>}
        {error && <div className="a1-error" role="alert">{error}{lastPrompt.current && <button className="a1-link-button" disabled={pending || !!retryAt} onClick={() => void submit(lastPrompt.current, true)}>{t.retry}</button>}{!errorHasGuide && <button className="a1-link-button" onClick={() => { setError(''); const reply = getFallbackReply(lastPrompt.current || STARTER_PROMPTS[language][0], language, sanitizeContext(context), messages.filter(item => item.role === 'user').map(item => item.text).slice(0, -1)); setMessages(items => [...items, { id: reply.turnId, role: 'assistant', text: reply.answer, reply }]); }}>{t.fallback}</button>}</div>}
        {voiceStatus && <p className="a1-status" role="status">{voiceStatus}<button className="a1-link-button" onClick={() => voice.current?.cancel()}>{t.cancel}</button></p>}
      </div>
      <form className="a1-composer" onSubmit={e => { e.preventDefault(); void submit(input); }}>
        <div className="a1-input-row"><label className="a1-sr-only" htmlFor="a1-question">{t.placeholder}</label><textarea ref={composer} id="a1-question" dir="auto" rows={1} value={input} maxLength={2000} placeholder={t.placeholder} disabled={resetting} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(input); } }} />
          {config.voiceEnabled && config.apiUrl && <button type="button" className="a1-icon-button a1-mic" disabled={pending || resetting} aria-label={voiceState === 'recording' ? t.stopMic : t.mic} title={voiceState === 'recording' ? t.stopMic : t.mic} aria-pressed={voiceState === 'recording'} onClick={mic}>{voiceState === 'recording' ? <Square size={17} /> : <Mic size={18} />}</button>}
          {pending ? <button type="button" className="a1-send" aria-label={t.cancel} onClick={stop}><Square size={17} /></button> : <button className="a1-send" type="submit" disabled={!input.trim() || resetting} aria-label={t.send}><ArrowUp size={19} /></button>}
        </div>
        <div className="a1-composer-tools"><span className="a1-small">{config.apiUrl ? t.footer : t.fallback}</span>{config.apiUrl && <details className="a1-privacy-details"><summary>{t.privacy}</summary><div className="a1-privacy-content"><p>{t.disclosure}</p>{config.voiceEnabled && <><p>{t.voiceDisclosure}</p><BasicVoiceLinks language={language} /></>}</div></details>}</div>
      </form>
    </section>}
  </div>;
}

export function BasicVoiceLinks({ language }: { language: Language }) {
  const text = language === 'ur' ? { label: 'بنیادی آواز:', license: 'لائسنس', source: 'سورس کوڈ' }
    : language === 'ur-Latn' ? { label: 'Bunyadi voice:', license: 'license', source: 'source code' }
    : { label: 'Basic voice:', license: 'license', source: 'source' };
  return <p className="a1-small" style={{ margin: '7px 0' }}>{text.label} <a className="a1-link-button" href="/assistant-assets/espeak/COPYING" target="_blank" rel="noopener noreferrer">{text.license}</a> &amp; <a className="a1-link-button" href="/assistant-assets/espeak/source.zip" download="espeak-source.zip">{text.source}</a></p>;
}

function actionLabel(action: AssistantAction, language: Language) {
  const labels = {
    en: { highlight_field: 'Show field', show_validation_group: 'Show issues', open_step: 'Go to step', open_documentation: 'Read guide', contact_team: 'Contact the team' },
    ur: { highlight_field: 'خانہ دکھائیں', show_validation_group: 'مسائل دکھائیں', open_step: 'مرحلہ کھولیں', open_documentation: 'رہنمائی پڑھیں', contact_team: 'ٹیم سے رابطہ' },
    'ur-Latn': { highlight_field: 'Field dikhayein', show_validation_group: 'Masail dikhayein', open_step: 'Qadam kholein', open_documentation: 'Guide parhein', contact_team: 'Team se rabta' },
  };
  return labels[language][action.type];
}

