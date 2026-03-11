/**
 * Low-level Odoo XML-RPC client.
 * Handles authentication with TTL-based uid invalidation.
 */

import xmlrpc from 'xmlrpc';

const url = new URL(process.env.ODOO_URL!);
const isSecure = url.protocol === 'https:';
const createClient = isSecure ? xmlrpc.createSecureClient : xmlrpc.createClient;
const port = url.port ? parseInt(url.port) : (isSecure ? 443 : 80);

export const commonClient = createClient({
  host: url.hostname,
  port,
  path: '/xmlrpc/2/common',
});

export const modelsClient = createClient({
  host: url.hostname,
  port,
  path: '/xmlrpc/2/object',
});

/**
 * Execute an XML-RPC method call on the given client.
 * Wraps the callback-based xmlrpc API into a Promise.
 */
export function call(client: xmlrpc.Client, method: string, params: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err: Error | null, result: unknown) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

let uid: number | null = null;
let uidExpiry = 0;
const UID_TTL = 3600_000; // 1 hour

/**
 * Detect Odoo HTML error responses disguised as XML-RPC.
 * Happens when Odoo returns a maintenance/error page instead of XML.
 */
export function isHtmlError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('Unknown XML-RPC tag');
}

/**
 * Authenticate against Odoo and return the user ID (uid).
 * Caches the uid for UID_TTL (1 hour) to avoid repeated auth calls.
 * Throws if authentication fails.
 */
export async function authenticate(): Promise<number> {
  if (uid && uidExpiry > Date.now()) return uid;
  uid = (await call(commonClient, 'authenticate', [
    process.env.ODOO_DB,
    process.env.ODOO_USER,
    process.env.ODOO_API_KEY,
    {},
  ])) as number;
  if (!uid) throw new Error('Autenticación con Odoo fallida.');
  uidExpiry = Date.now() + UID_TTL;
  return uid;
}

/** Invalidate cached uid. Called after HTML error to force re-authentication. */
export function resetUid(): void {
  uid = null;
  uidExpiry = 0;
}
