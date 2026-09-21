import { describe, expect, it } from "vitest";
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from "./_core/googleOAuth";
import { decodeOAuthState, encodeOAuthState } from "../shared/const";

describe("Google OAuth 2.0 helper", () => {
  it("encodes and decodes OAuth state preserving nonce and redirectUri", () => {
    const original = { redirectUri: "/profile", nonce: "test-nonce-12345" };
    const encoded = encodeOAuthState(original);
    expect(typeof encoded).toBe("string");

    const decoded = decodeOAuthState(encoded);
    expect(decoded.redirectUri).toBe("/profile");
    expect(decoded.nonce).toBe("test-nonce-12345");
  });

  it("handles malformed OAuth state gracefully", () => {
    const decoded = decodeOAuthState("not-valid-base64!!!");
    expect(decoded).toBeDefined();
    expect(decoded.redirectUri).toBe("");
    expect(decoded.nonce).toBeUndefined();
  });

  it("constructs valid Google OAuth 2.0 authorization URL", () => {
    const state = "sample-state-token";
    const urlString = getGoogleAuthUrl(state, "http://localhost:3000/api/oauth/callback");
    const url = new URL(urlString);

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toContain("openid");
    expect(url.searchParams.get("scope")).toContain("email");
    expect(url.searchParams.get("scope")).toContain("profile");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/oauth/callback");
    expect(url.searchParams.get("state")).toBe(state);
  });

  it("reports configuration status correctly", () => {
    expect(typeof isGoogleOAuthConfigured()).toBe("boolean");
  });
});
