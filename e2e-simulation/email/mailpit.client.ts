/**
 * AegisOne E2E Simulation — Mailpit Client
 *
 * Wraps the Mailpit REST API to:
 *   - Poll for email delivery
 *   - Retrieve email content and extract phishing links
 *   - Clear the inbox between runs
 *
 * Mailpit API reference: https://mailpit.axllent.org/docs/usage/api/
 * Base URL: http://localhost:8025/api/v1
 */

import axios, { AxiosInstance } from 'axios';
import { Config } from '../config';

export interface MailpitMessage {
  ID: string;
  Subject: string;
  From: { Address: string; Name: string };
  To: Array<{ Address: string; Name: string }>;
  Date: string;
  Snippet: string;
}

export interface MailpitMessageDetail {
  ID: string;
  Subject: string;
  HTML: string;
  Text: string;
  From: { Address: string; Name: string };
  To: Array<{ Address: string; Name: string }>;
}

export interface ParsedEmail {
  messageId: string;
  subject: string;
  to: string;
  from: string;
  html: string;
  text: string;
  links: string[];
  receivedAt: string;
}

export class MailpitClient {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${Config.MAILPIT_API_URL}/api/v1`,
      timeout: 10_000,
    });
  }

  /**
   * Wait until all addresses in `toAddresses` have at least one email,
   * or until timeout expires.
   */
  async waitForEmails(
    toAddresses: string[],
    timeoutMs: number = Config.EMAIL_WAIT_TIMEOUT_MS,
  ): Promise<Map<string, MailpitMessage>> {
    const deadline = Date.now() + timeoutMs;
    const received = new Map<string, MailpitMessage>();

    while (Date.now() < deadline) {
      const messages = await this.listMessages(200);

      for (const msg of messages) {
        for (const recipient of msg.To) {
          const addr = recipient.Address.toLowerCase();
          if (toAddresses.includes(addr) && !received.has(addr)) {
            received.set(addr, msg);
          }
        }
      }

      if (received.size === toAddresses.length) break;

      // Poll every 1s
      await sleep(1000);
    }

    return received;
  }

  /**
   * List recent messages (up to limit)
   */
  async listMessages(limit = 100): Promise<MailpitMessage[]> {
    const resp = await this.api.get('/messages', {
      params: { limit },
    });
    return resp.data.messages || [];
  }

  /**
   * Get full email body for a specific message ID
   */
  async getMessage(messageId: string): Promise<MailpitMessageDetail> {
    const resp = await this.api.get(`/message/${messageId}`);
    return resp.data;
  }

  /**
   * Parse an email and extract all HTTP/HTTPS links from HTML body.
   * This is used to find the phishing test link that the employee should click.
   */
  async getParsedEmail(messageId: string): Promise<ParsedEmail> {
    const detail = await this.getMessage(messageId);

    const links = extractLinks(detail.HTML || detail.Text || '');
    const to = detail.To?.[0]?.Address || '';
    const from = detail.From?.Address || '';

    return {
      messageId: detail.ID,
      subject: detail.Subject,
      to,
      from,
      html: detail.HTML || '',
      text: detail.Text || '',
      links,
      receivedAt: new Date().toISOString(),
    };
  }

  /**
   * Get the first message addressed to a specific email.
   * Returns undefined if not found.
   */
  async getEmailFor(address: string, limit = 200): Promise<ParsedEmail | undefined> {
    const messages = await this.listMessages(limit);
    const lowerAddr = address.toLowerCase();

    const msg = messages.find(m =>
      m.To.some(t => t.Address.toLowerCase() === lowerAddr)
    );

    if (!msg) return undefined;
    return this.getParsedEmail(msg.ID);
  }

  /**
   * Delete all messages (clear inbox for test isolation)
   */
  async clearAll(): Promise<void> {
    try {
      await this.api.delete('/messages');
    } catch (err) {
      // Mailpit might not have messages — that's fine
      console.warn('  ⚠ Mailpit clear: ' + (err as Error).message);
    }
  }

  /**
   * Health check — is Mailpit running?
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.api.get('/info');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse the HTML body of an AegisOne Welcome Email and extract the generated password.
   */
  extractWelcomeCredentials(htmlBody: string): string | null {
    // Looks for: <strong>Temporary Password:</strong> <span ...>PASSWORD</span>
    const match = htmlBody.match(/Temporary Password:.*?<span[^>]*>([^<]+)<\/span>/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractLinks(html: string): string[] {
  const links: string[] = [];
  // Match href="..." and src="..." attributes
  const hrefRegex = /href="(https?:\/\/[^"]+)"/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1];
    if (!links.includes(url)) {
      links.push(url);
    }
  }

  return links;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
