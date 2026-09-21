import { randomBytes } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState, encodeOAuthState } from "@shared/const";
import { UserModel, type User } from "../models";
import { authConfig, issueAuthTokens } from "../auth";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
  getGoogleUserInfo,
  isGoogleOAuthConfigured,
} from "./googleOAuth";
import { sdk } from "./sdk";

const DEV_OAUTH_STATE_COOKIE = "oauth_state";

function isSecure(req: Request): boolean {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

function getEffectiveStateCookieName(req: Request): string {
  return isSecure(req) ? OAUTH_STATE_COOKIE : DEV_OAUTH_STATE_COOKIE;
}

function getRedirectUri(req: Request): string {
  if (ENV.googleRedirectUri && !ENV.googleRedirectUri.includes("localhost")) {
    return ENV.googleRedirectUri;
  }
  const protocol = isSecure(req) ? "https" : "http";
  const host = req.get("host") || "localhost:3000";
  return `${protocol}://${host}/api/oauth/callback`;
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Initiates Google OAuth 2.0 flow
  const initiateGoogleAuth = (req: Request, res: Response) => {
    if (!isGoogleOAuthConfigured()) {
      console.warn("[Google OAuth] Credentials are not configured in .env");
      res.redirect("/auth?error=google_not_configured");
      return;
    }

    const nonce = randomBytes(16).toString("hex");
    const returnPath = getQueryParam(req, "returnTo") || "/";
    const state = encodeOAuthState({ redirectUri: returnPath, nonce });

    const cookieName = getEffectiveStateCookieName(req);
    res.cookie(cookieName, nonce, {
      path: "/",
      httpOnly: true,
      secure: isSecure(req),
      sameSite: "lax",
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    const authUrl = getGoogleAuthUrl(state, getRedirectUri(req));
    res.redirect(302, authUrl);
  };

  app.get("/api/oauth/google", initiateGoogleAuth);
  app.get("/api/oauth/login", initiateGoogleAuth);

  // Handles Google OAuth 2.0 callback
  const handleOAuthCallback = async (req: Request, res: Response) => {
    const error = getQueryParam(req, "error");
    if (error) {
      console.warn("[Google OAuth] Provider returned error:", error);
      res.redirect(`/auth?error=${encodeURIComponent(error)}`);
      return;
    }

    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).redirect("/auth?error=invalid_oauth_request");
      return;
    }

    // CSRF Guard: Validate nonce
    const { nonce, redirectUri: returnPath } = decodeOAuthState(state);
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const cookieName = getEffectiveStateCookieName(req);
    const expectedNonce = cookies[cookieName] || cookies[OAUTH_STATE_COOKIE] || cookies[DEV_OAUTH_STATE_COOKIE];

    if (!nonce || nonce !== expectedNonce) {
      console.warn("[Google OAuth] State nonce mismatch or missing CSRF cookie");
      res.status(403).redirect("/auth?error=invalid_oauth_state");
      return;
    }

    // Clear the one-time state cookies
    res.clearCookie(cookieName, { path: "/", secure: isSecure(req), sameSite: "lax" });
    if (cookieName !== OAUTH_STATE_COOKIE) {
      res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "lax" });
    }

    try {
      // 1. Exchange authorization code for tokens
      const tokenResponse = await exchangeGoogleCode(code, getRedirectUri(req));

      // 2. Fetch user profile from Google
      const googleUser = await getGoogleUserInfo(tokenResponse.access_token);

      if (!googleUser.email) {
        res.status(400).redirect("/auth?error=email_required");
        return;
      }

      const email = googleUser.email.trim().toLowerCase();
      const openId = `google_${googleUser.id}`;
      const now = new Date();

      // 3. Find or create user in MongoDB
      let user = await UserModel.findOne({ email }).lean();

      if (user) {
        // Link Google account and update metadata
        await UserModel.updateOne(
          { _id: user._id },
          {
            $set: {
              openId: user.openId || openId,
              avatar: user.avatar || googleUser.picture || null,
              name: user.name || googleUser.name || null,
              loginMethod: user.loginMethod || "google",
              lastSignedIn: now,
            },
          }
        );
        user = await UserModel.findById(user._id).lean();
      } else {
        // Create new user from Google profile
        const created = await UserModel.create({
          openId,
          name: googleUser.name || email.split("@")[0],
          email,
          avatar: googleUser.picture || null,
          loginMethod: "google",
          role: "user",
          department: "Engineering",
          givingAllowance: 100,
          earnedPoints: 0,
          lastSignedIn: now,
        });
        user = await UserModel.findById(created._id).lean();
      }

      if (!user) {
        throw new Error("Failed to retrieve or create user record");
      }

      const userDoc: User = {
        ...user,
        id: String(user._id),
      } as User;

      // 4. Issue application JWT and refresh token
      const authTokens = await issueAuthTokens(userDoc);

      // 5. Set refresh token cookie for session restoration
      res.cookie(authConfig.refreshCookieName, authTokens.refreshToken, {
        ...getSessionCookieOptions(req),
        maxAge: authConfig.refreshTokenTtlMs,
      });

      // 6. Set app session cookie for legacy/scaffold compatibility
      const sessionToken = await sdk.createSessionToken(userDoc.openId, {
        name: userDoc.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });

      // Redirect to return path or root with access token for instant frontend hydration
      const destination = returnPath && returnPath.startsWith("/") ? returnPath : "/";
      const sep = destination.includes("?") ? "&" : "?";
      res.redirect(302, `${destination}${sep}token=${encodeURIComponent(authTokens.accessToken)}`);
    } catch (err: any) {
      console.error("[Google OAuth] Callback handling failed:", err?.response?.data || err.message || err);
      res.redirect("/auth?error=oauth_exchange_failed");
    }
  };

  app.get("/api/oauth/callback", handleOAuthCallback);
  app.get("/api/oauth/google/callback", handleOAuthCallback);
}
