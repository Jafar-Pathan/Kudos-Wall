import mongoose, { Schema } from "mongoose";

/* ------------------------------------------------------------------ */
/*  TypeScript interfaces (replaces the old Drizzle-inferred types)    */
/* ------------------------------------------------------------------ */

export interface User {
  id: string;
  _id: mongoose.Types.ObjectId;
  openId: string;
  name: string | null;
  email: string | null;
  passwordHash: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  department: "Engineering" | "Design" | "Marketing" | "Sales";
  avatar: string | null;
  givingAllowance: number;
  earnedPoints: number;
  emailVerified: boolean;
  verificationTokenHash?: string | null;
  verificationTokenExpiresAt?: Date | null;
  resetPasswordTokenHash?: string | null;
  resetPasswordTokenExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

export interface InsertUser {
  openId: string;
  name?: string | null;
  email?: string | null;
  passwordHash?: string | null;
  loginMethod?: string | null;
  role?: "user" | "admin";
  department?: "Engineering" | "Design" | "Marketing" | "Sales";
  avatar?: string | null;
  givingAllowance?: number;
  earnedPoints?: number;
  emailVerified?: boolean;
  verificationTokenHash?: string | null;
  verificationTokenExpiresAt?: Date | null;
  resetPasswordTokenHash?: string | null;
  resetPasswordTokenExpiresAt?: Date | null;
  lastSignedIn?: Date;
}

export interface RefreshToken {
  id: string;
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface InsertRefreshToken {
  userId: mongoose.Types.ObjectId | string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
}

export interface Kudos {
  id: string;
  _id: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  points: number;
  message: string;
  valueTags: string[];
  reactions: Record<string, any>;
  createdAt: Date;
}

export interface InsertKudos {
  senderId: mongoose.Types.ObjectId | string;
  recipientId: mongoose.Types.ObjectId | string;
  points: number;
  message: string;
  valueTags: string[];
  reactions?: Record<string, any>;
}

/* ------------------------------------------------------------------ */
/*  Users schema & model                                               */
/* ------------------------------------------------------------------ */

const userSchema = new Schema(
  {
    openId: { type: String, required: true, unique: true },
    name: { type: String, default: null },
    email: { type: String, default: null },
    passwordHash: { type: String, default: null },
    loginMethod: { type: String, default: null },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      required: true,
    },
    department: {
      type: String,
      enum: ["Engineering", "Design", "Marketing", "Sales"],
      default: "Engineering",
      required: true,
    },
    avatar: { type: String, default: null },
    givingAllowance: { type: Number, default: 100, required: true },
    earnedPoints: { type: Number, default: 0, required: true },
    emailVerified: { type: Boolean, default: false },
    verificationTokenHash: { type: String, default: null },
    verificationTokenExpiresAt: { type: Date, default: null },
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordTokenExpiresAt: { type: Date, default: null },
    lastSignedIn: { type: Date, default: Date.now, required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Ensure unique email index (sparse so multiple nulls are allowed)
userSchema.index({ email: 1 }, { unique: true, sparse: true });

export const UserModel = mongoose.model("User", userSchema);

/* ------------------------------------------------------------------ */
/*  Refresh Tokens schema & model                                      */
/* ------------------------------------------------------------------ */

const refreshTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, required: true },
});

export const RefreshTokenModel = mongoose.model(
  "RefreshToken",
  refreshTokenSchema,
);

/* ------------------------------------------------------------------ */
/*  Kudos schema & model                                               */
/* ------------------------------------------------------------------ */

const kudosSchema = new Schema({
  senderId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  recipientId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  points: { type: Number, required: true },
  message: { type: String, required: true },
  valueTags: { type: [String], required: true },
  reactions: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, required: true },
});

export const KudosModel = mongoose.model("Kudos", kudosSchema);
