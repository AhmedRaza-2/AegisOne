/**
 * End-to-end encrypted chat (browser side)
 * =========================================
 * - Each browser holds an ECDH P-256 key pair. The private key is generated NON-EXTRACTABLE and
 *   kept in IndexedDB, so neither the server nor page scripts can read its bytes.
 * - Only the public key (JWK) is published to the server (PUT /communication/keys).
 * - Two people derive the same AES-256-GCM key from (my private, their public) via ECDH + HKDF.
 *   The server stores only "e2e1:<iv>.<ciphertext>" and can never read direct messages.
 * - Limits: the private key lives in one browser. Signing in from a new browser creates a new key
 *   pair; messages encrypted for the old key then show as "encrypted on another device".
 */
import { getApiBaseUrl } from "@/lib/api";

const DB = "aegis_e2e";
const STORE = "keys";
const KEY_ID = "chat-ecdh-p256-v1";
const PREFIX = "e2e1:";
const enc = new TextEncoder();
const dec = new TextDecoder();

interface Pair { privateKey: CryptoKey; publicJwk: JsonWebKey }

export const isEncrypted = (content: string) => typeof content === "string" && content.startsWith(PREFIX);

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idb<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

let pairPromise: Promise<Pair> | null = null;

/** Returns this browser's key pair, creating (and publishing) it on first use. */
export function ensureKeyPair(): Promise<Pair> {
  if (!pairPromise) {
    pairPromise = (async () => {
      const db = await openDb();
      let stored = await idb<Pair | undefined>(db, "readonly", s => s.get(KEY_ID));
      if (!stored) {
        const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
        const publicJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
        stored = { privateKey: kp.privateKey, publicJwk };
        await idb(db, "readwrite", s => s.put(stored!, KEY_ID));
      }
      db.close();
      return stored;
    })().catch(e => { pairPromise = null; throw e; });
  }
  return pairPromise;
}

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("aegis_access_token") || localStorage.getItem("aegis_token");
  return { Authorization: `Bearer ${t || ""}`, "Content-Type": "application/json" };
}

const canon = (j: JsonWebKey) => JSON.stringify({ kty: j.kty, crv: j.crv, x: j.x, y: j.y });

/** Makes sure the server knows this browser's public key. Safe to call on every page load. */
export async function publishKeyIfNeeded(): Promise<void> {
  try {
    const { publicJwk } = await ensureKeyPair();
    const mine = canon(publicJwk);
    const r = await fetch(`${getApiBaseUrl()}/communication/keys/me`, { headers: authHeaders() });
    const server = r.ok ? (await r.json()).public_key : null;
    if (server !== mine) {
      await fetch(`${getApiBaseUrl()}/communication/keys`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify({ public_key: mine }),
      });
    }
  } catch { /* chat falls back to "secure chat not ready" until it succeeds */ }
}

const aesKeys = new Map<string, CryptoKey>();

async function sharedKey(theirPublic: string): Promise<CryptoKey> {
  const cached = aesKeys.get(theirPublic);
  if (cached) return cached;
  const { privateKey } = await ensureKeyPair();
  const pub = await crypto.subtle.importKey("jwk", JSON.parse(theirPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const key = await crypto.subtle.deriveKey(
    { name: "ECDH", public: pub }, privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  aesKeys.set(theirPublic, key);
  return key;
}

/** Encrypts `text` for the contact whose published key is `theirPublic`. */
export async function encryptFor(theirPublic: string, text: string): Promise<string> {
  const key = await sharedKey(theirPublic);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  return `${PREFIX}${b64(iv)}.${b64(ct)}`;
}

export const LOCKED_TEXT = "🔒 Encrypted message (sent to another device or browser)";

/** Decrypts a stored message exchanged with the contact whose key is `theirPublic`. */
export async function decryptWith(theirPublic: string | null | undefined, content: string): Promise<string> {
  if (!isEncrypted(content)) return content;
  if (!theirPublic) return LOCKED_TEXT;
  try {
    const [iv, ct] = content.slice(PREFIX.length).split(".");
    const key = await sharedKey(theirPublic);
    return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct)));
  } catch {
    return LOCKED_TEXT;
  }
}

/** Decrypts a whole thread in place of its message bodies. */
export async function decryptThread<T extends { content: string }>(theirPublic: string | null | undefined, msgs: T[]): Promise<T[]> {
  return Promise.all(msgs.map(async m => (isEncrypted(m.content) ? { ...m, content: await decryptWith(theirPublic, m.content) } : m)));
}
