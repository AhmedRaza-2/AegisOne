import fs from 'fs';
import path from 'path';

export interface TelemetryEvent {
  run_id: string;
  timestamp: string;
  actor: string;
  role: string;
  organization: string;
  session_id?: string;
  action: string;
  url?: string;
  test_case_id?: string;
  scan_id?: string;
  event_id?: string;
  result?: string;
  latency_ms?: number;
  [key: string]: any;
}

export class SimulationLogger {
  private runId: string;
  private artifactsDir: string;
  private eventsFile: string;

  constructor(runId: string) {
    this.runId = runId;
    this.artifactsDir = path.resolve(process.cwd(), 'artifacts', runId);
    this.eventsFile = path.join(this.artifactsDir, 'events.jsonl');
    
    // Ensure artifacts directory exists
    if (!fs.existsSync(this.artifactsDir)) {
      fs.mkdirSync(this.artifactsDir, { recursive: true });
    }
  }

  /**
   * Redact sensitive query parameters from URLs
   */
  private sanitizeUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    try {
      const u = new URL(url);
      const paramsToRedact = ['token', 'auth', 'key', 'session', 'password', 'pwd'];
      for (const [key, _] of u.searchParams.entries()) {
        if (paramsToRedact.some(p => key.toLowerCase().includes(p))) {
          u.searchParams.set(key, '<REDACTED>');
        }
      }
      return u.toString();
    } catch {
      return url; // fallback if not a valid URL
    }
  }

  logEvent(event: Omit<TelemetryEvent, 'run_id' | 'timestamp'>) {
    const fullEvent = {
      run_id: this.runId,
      timestamp: new Date().toISOString(),
      ...event,
      url: this.sanitizeUrl(event.url),
    } as TelemetryEvent;

    // 1. Write to JSONL
    fs.appendFileSync(this.eventsFile, JSON.stringify(fullEvent) + '\n');

    // 2. Format for terminal
    const time = fullEvent.timestamp.split('T')[1].split('.')[0];
    let terminalStr = `[${time}] ${fullEvent.action.padEnd(25)}`;
    
    const parts = [];
    if (fullEvent.actor) parts.push(`actor=${fullEvent.actor}`);
    if (fullEvent.role) parts.push(`role=${fullEvent.role}`);
    if (fullEvent.test_case_id) parts.push(`test_case=${fullEvent.test_case_id}`);
    if (fullEvent.url) parts.push(`url=${fullEvent.url}`);
    if (fullEvent.result) parts.push(`result=${fullEvent.result}`);
    if (fullEvent.latency_ms !== undefined) parts.push(`latency=${fullEvent.latency_ms}ms`);
    if (fullEvent.scan_id) parts.push(`scan_id=${fullEvent.scan_id}`);
    
    console.log(`${terminalStr} ${parts.join(' ')}`);
  }
}
