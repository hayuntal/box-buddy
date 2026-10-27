import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * The session cookie for the in-process adapter.
 *
 * Signed rather than encrypted: it carries nothing secret, only a user id, and
 * the signature is what stops a visitor from editing it into someone else's
 * household. The Supabase path uses Supabase's own auth cookies and ignores
 * this file.
 */

const COOKIE = "bb_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET חסר — אי אפשר לחתום על עוגיית ההתחברות.");
  }
  // Development only, and only on the in-memory adapter whose data is thrown
  // away on restart anyway.
  return "box-buddy-dev-secret";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function serializeSessionValue(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

/** Returns the user id when the signature checks out, null otherwise. */
export function readSessionValue(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;

  const userId = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(userId));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, serializeSessionValue(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function currentUserId(): Promise<string | null> {
  const store = await cookies();
  return readSessionValue(store.get(COOKIE)?.value);
}
