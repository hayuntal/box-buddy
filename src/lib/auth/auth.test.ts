import { describe, expect, it } from "vitest";
import { readSessionValue, serializeSessionValue } from "./cookie";
import {
  describePasswordProblem,
  hashPassword,
  isEmailShaped,
  normalizeEmail,
  verifyPassword,
} from "./password";

describe("password hashing", () => {
  it("accepts the password it was given", async () => {
    const stored = await hashPassword("לחם-עם-חומוס1");
    expect(await verifyPassword("לחם-עם-חומוס1", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("boxbuddy1");
    expect(await verifyPassword("boxbuddy2", stored)).toBe(false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    expect(await hashPassword("boxbuddy1")).not.toBe(await hashPassword("boxbuddy1"));
  });

  it("rejects a stored value that is not a hash", async () => {
    expect(await verifyPassword("boxbuddy1", "boxbuddy1")).toBe(false);
    expect(await verifyPassword("boxbuddy1", "")).toBe(false);
    expect(await verifyPassword("boxbuddy1", "md5$aa$bb")).toBe(false);
  });

  it("names the length requirement, and nothing else", () => {
    expect(describePasswordProblem("short")).toMatch(/8/);
    expect(describePasswordProblem("longenough")).toBeNull();
  });
});

describe("email handling", () => {
  it("normalizes case and surrounding space", () => {
    expect(normalizeEmail("  Parent@Example.COM ")).toBe("parent@example.com");
  });

  it("recognizes an address shape", () => {
    expect(isEmailShaped("parent@example.com")).toBe(true);
    expect(isEmailShaped("parent@example")).toBe(false);
    expect(isEmailShaped("parent example.com")).toBe(false);
  });
});

describe("session cookie", () => {
  it("round-trips a user id", () => {
    expect(readSessionValue(serializeSessionValue("user-demo"))).toBe("user-demo");
  });

  // The whole point of signing: the cookie is the only thing deciding whose
  // household loads, so an edited one must read as no session at all.
  it("refuses a cookie whose user id was swapped", () => {
    const value = serializeSessionValue("user-demo");
    const signature = value.slice(value.lastIndexOf("."));
    expect(readSessionValue(`user-someone-else${signature}`)).toBeNull();
  });

  it("refuses a missing, empty or unsigned cookie", () => {
    expect(readSessionValue(undefined)).toBeNull();
    expect(readSessionValue("")).toBeNull();
    expect(readSessionValue("user-demo")).toBeNull();
    expect(readSessionValue(".sig")).toBeNull();
  });
});
