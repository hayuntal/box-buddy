"use server";

import { redirect } from "next/navigation";
import { getRepo } from "@/lib/db";

/**
 * The three auth mutations. Each one hands the credentials straight to the
 * adapter — this file never hashes, compares or stores anything itself, so the
 * in-memory and Postgres paths cannot drift apart on the part that matters.
 */

/** `email` comes back so a rejected form does not make them retype it. */
export type FormState = { error?: string; email?: string };

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = text(form, "email");
  const result = await getRepo().authenticate(email, text(form, "password"));
  if (!result.ok) return { error: result.reason, email };
  redirect("/today");
}

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const email = text(form, "email");
  const result = await getRepo().createAccount({
    email,
    password: text(form, "password"),
    displayName: text(form, "displayName"),
    householdName: text(form, "householdName"),
  });
  if (!result.ok) return { error: result.reason, email };
  redirect("/children");
}

export async function signOut(): Promise<void> {
  await getRepo().endSession();
  redirect("/login");
}
