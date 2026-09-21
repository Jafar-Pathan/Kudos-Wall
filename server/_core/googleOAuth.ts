import axios from "axios";
import { ENV } from "./env";

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  refresh_token?: string;
  id_token?: string;
}

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    ENV.googleClientId &&
      ENV.googleClientId !== "your-google-client-id.apps.googleusercontent.com" &&
      ENV.googleClientSecret &&
      ENV.googleClientSecret !== "your-google-client-secret"
  );
}

export function getGoogleAuthUrl(state: string, redirectUri?: string): string {
  const effectiveRedirectUri = redirectUri || ENV.googleRedirectUri;
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: effectiveRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri?: string
): Promise<GoogleTokenResponse> {
  const effectiveRedirectUri = redirectUri || ENV.googleRedirectUri;
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    client_secret: ENV.googleClientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: effectiveRedirectUri,
  });

  const response = await axios.post<GoogleTokenResponse>(
    GOOGLE_TOKEN_ENDPOINT,
    params.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 15_000,
    }
  );

  return response.data;
}

export async function getGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  const response = await axios.get<GoogleUserInfo>(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    timeout: 15_000,
  });

  return response.data;
}
