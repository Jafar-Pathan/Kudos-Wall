import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import mongoose from "mongoose";
import { UserModel, RefreshTokenModel, type User } from "./models";
import { ENV } from "./_core/env";
import { SignJWT, jwtVerify } from "jose";

const scrypt = promisify(scryptCallback);
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 8;

function getSecret() {
  if (!ENV.cookieSecret)
    throw new Error("JWT_SECRET is required for authentication");
  return new TextEncoder().encode(ENV.cookieSecret);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validatePassword(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH)
    throw new Error("PASSWORD_TOO_SHORT");
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    throw new Error("PASSWORD_COMPLEXITY");
}

export async function hashPassword(password: string) {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  encoded: string | null,
) {
  if (!encoded?.startsWith("scrypt$")) return false;
  const [, salt, expectedHex] = encoded.split("$");
  if (!salt || !expectedHex) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/* ------------------------------------------------------------------ */
/*  User queries                                                       */
/* ------------------------------------------------------------------ */

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

export async function getUserByEmail(email: string) {
  if (!isDbReady()) return undefined;
  const doc = await UserModel.findOne({
    email: normalizeEmail(email),
  }).lean();
  return doc ? toUserDoc(doc) : undefined;
}

export async function getUserById(id: string | mongoose.Types.ObjectId) {
  if (!isDbReady()) return undefined;
  const doc = await UserModel.findById(id).lean();
  return doc ? toUserDoc(doc) : undefined;
}

export async function createCredentialUser(input: {
  name: string;
  email: string;
  password: string;
  department?: User["department"];
}) {
  if (!isDbReady()) throw new Error("DATABASE_UNAVAILABLE");
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const openId = `local_${randomUUID()}`;

  const doc = await UserModel.create({
    openId,
    name: input.name.trim(),
    email,
    passwordHash,
    loginMethod: "password",
    department: input.department ?? "Engineering",
  });

  const created = await getUserById(doc._id);
  if (!created) throw new Error("USER_CREATE_FAILED");
  return created;
}

export async function updateUserProfile(input: {
  id: string;
  name: string;
  email: string;
  department: User["department"];
}) {
  if (!isDbReady()) throw new Error("DATABASE_UNAVAILABLE");
  await UserModel.updateOne(
    { _id: input.id },
    {
      $set: {
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        department: input.department,
      },
    },
  );
  const updated = await getUserById(input.id);
  if (!updated) throw new Error("USER_NOT_FOUND");
  return updated;
}

export async function changeUserPassword(input: {
  id: string;
  currentPassword: string;
  newPassword: string;
}) {
  if (!isDbReady()) throw new Error("DATABASE_UNAVAILABLE");
  const user = await getUserById(input.id);
  if (
    !user ||
    !(await verifyPassword(input.currentPassword, user.passwordHash))
  )
    throw new Error("CURRENT_PASSWORD_INVALID");
  const passwordHash = await hashPassword(input.newPassword);
  await UserModel.updateOne(
    { _id: input.id },
    { $set: { passwordHash, loginMethod: "password" } },
  );
  return true;
}

export async function markUserSignedIn(id: string) {
  if (!isDbReady()) return;
  await UserModel.updateOne(
    { _id: id },
    { $set: { lastSignedIn: new Date() } },
  );
}

/* ------------------------------------------------------------------ */
/*  JWT & Refresh tokens                                               */
/* ------------------------------------------------------------------ */

export async function issueAuthTokens(user: ReturnType<typeof toUserDoc>) {
  if (!isDbReady()) throw new Error("DATABASE_UNAVAILABLE");

  const accessToken = await new SignJWT({
    sub: String(user.id),
    email: user.email,
    role: user.role,
    type: "access",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecret());

  const refreshToken = randomBytes(48).toString("base64url");
  await RefreshTokenModel.create({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function rotateRefreshToken(rawToken: string) {
  if (!isDbReady()) throw new Error("DATABASE_UNAVAILABLE");
  const tokenHash = hashRefreshToken(rawToken);

  const stored = await RefreshTokenModel.findOne({
    tokenHash,
    revokedAt: null,
  }).lean();
  if (!stored || stored.expiresAt.getTime() <= Date.now())
    throw new Error("REFRESH_TOKEN_INVALID");

  const user = await getUserById(stored.userId);
  if (!user) throw new Error("REFRESH_TOKEN_INVALID");

  await RefreshTokenModel.updateOne(
    { _id: stored._id },
    { $set: { revokedAt: new Date() } },
  );

  return { user, ...(await issueAuthTokens(user)) };
}

export async function revokeRefreshToken(rawToken?: string) {
  if (!rawToken) return;
  if (!isDbReady()) return;
  await RefreshTokenModel.updateOne(
    { tokenHash: hashRefreshToken(rawToken) },
    { $set: { revokedAt: new Date() } },
  );
}

export async function verifyAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    if (payload.type !== "access" || typeof payload.sub !== "string")
      return null;
    return getUserById(payload.sub);
  } catch {
    return null;
  }
}

export async function getUserByRefreshToken(rawToken: string) {
  if (!isDbReady() || !rawToken) return null;
  try {
    const tokenHash = hashRefreshToken(rawToken);
    const stored = await RefreshTokenModel.findOne({
      tokenHash,
      revokedAt: null,
    }).lean();
    if (!stored || stored.expiresAt.getTime() <= Date.now()) return null;
    return (await getUserById(stored.userId)) ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Config export                                                      */
/* ------------------------------------------------------------------ */

export const authConfig = {
  refreshCookieName: "kudos_refresh_token",
  accessTokenTtlSeconds: ACCESS_TOKEN_TTL_SECONDS,
  refreshTokenTtlMs: REFRESH_TOKEN_TTL_MS,
  passwordMinLength: PASSWORD_MIN_LENGTH,
};

/* ------------------------------------------------------------------ */
/*  Internal helper                                                    */
/* ------------------------------------------------------------------ */

function toUserDoc(doc: Record<string, any>): User {
  return {
    ...doc,
    id: String(doc._id),
  } as User;
}
