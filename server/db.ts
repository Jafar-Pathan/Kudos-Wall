import mongoose from "mongoose";
import { UserModel, KudosModel, type User } from "./models";

/* ------------------------------------------------------------------ */
/*  Connection helper                                                  */
/* ------------------------------------------------------------------ */

export async function getDb() {
  if (mongoose.connection.readyState !== 1) return null;
  return mongoose.connection;
}

/* ------------------------------------------------------------------ */
/*  User helpers                                                       */
/* ------------------------------------------------------------------ */

export async function upsertUser(user: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  avatar?: string | null;
  department?: User["department"];
  role?: User["role"];
  lastSignedIn?: Date;
}): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  if (!(await getDb())) return;

  const update: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod", "avatar"] as const) {
    if (user[field] !== undefined) update[field] = user[field] ?? null;
  }
  if (user.department !== undefined) update.department = user.department;
  if (user.role !== undefined) update.role = user.role;

  await UserModel.findOneAndUpdate(
    { openId: user.openId },
    { $set: update, $setOnInsert: { openId: user.openId } },
    { upsert: true },
  );
}

export async function getUserByOpenId(openId: string) {
  if (!(await getDb())) return undefined;
  const doc = await UserModel.findOne({ openId }).lean();
  return doc ? toUser(doc) : undefined;
}

export async function getUsersByIds(ids: (string | mongoose.Types.ObjectId)[]): Promise<User[]> {
  if (!(await getDb()) || ids.length === 0) return [];
  const docs = await UserModel.find({ _id: { $in: ids } }).lean();
  return docs.map(toUser);
}

export async function searchUsers(query: string, excludeId?: string) {
  if (!(await getDb())) return [];
  const pattern = query.trim();
  const filter: Record<string, unknown> = {
    $or: [
      { name: { $regex: pattern, $options: "i" } },
      { email: { $regex: pattern, $options: "i" } },
    ],
  };
  if (excludeId) filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  const docs = await UserModel.find(filter)
    .select("name email avatar department")
    .sort({ name: 1 })
    .limit(8)
    .lean();
  return docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    email: d.email,
    avatar: d.avatar,
    department: d.department,
  }));
}

/* ------------------------------------------------------------------ */
/*  Kudos feed                                                         */
/* ------------------------------------------------------------------ */

export function parseTags(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function parseReactions(
  value: Record<string, number> | string | null | undefined,
): Record<string, number> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, number>;
  try {
    const parsed = JSON.parse((value as string) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function getFeed(limit: number, cursor?: string) {
  if (!(await getDb())) return { rows: [], nextCursor: undefined as string | undefined };
  const filter: Record<string, unknown> = {};
  if (cursor) filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };

  const rows = await KudosModel.find(filter)
    .sort({ _id: -1 })
    .limit(limit)
    .lean();

  const ids = Array.from(
    new Set(rows.flatMap((r) => [String(r.senderId), String(r.recipientId)])),
  ).map((id) => new mongoose.Types.ObjectId(id));
  const people = await getUsersByIds(ids);
  const peopleById = new Map(people.map((p) => [String(p.id), p]));

  return {
    rows: rows.map((r) => ({
      id: String(r._id),
      senderId: String(r.senderId),
      recipientId: String(r.recipientId),
      points: r.points,
      message: r.message,
      tags: parseTags(r.valueTags),
      reactions: parseReactions(r.reactions),
      createdAt: r.createdAt,
      sender: peopleById.get(String(r.senderId)),
      recipient: peopleById.get(String(r.recipientId)),
    })),
    nextCursor:
      rows.length === limit ? String(rows[rows.length - 1]?._id) : undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Give kudos (atomic)                                                */
/* ------------------------------------------------------------------ */

export async function createKudosAtomic(input: {
  senderId: string;
  recipientId: string;
  points: number;
  message: string;
  tags: string[];
}) {
  if (!(await getDb())) throw new Error("Database unavailable");

  const session = await mongoose.startSession();
  try {
    let result: { id: string; recipientName: string | null } = { id: "", recipientName: null };

    await session.withTransaction(async () => {
      const sender = await UserModel.findById(input.senderId).session(session);
      const recipient = await UserModel.findById(input.recipientId).session(session);
      if (!sender || !recipient) throw new Error("USER_NOT_FOUND");
      if (String(sender._id) === String(recipient._id)) throw new Error("SELF_GIFT");
      if (sender.givingAllowance < input.points) throw new Error("INSUFFICIENT_ALLOWANCE");

      const updated = await UserModel.findOneAndUpdate(
        { _id: sender._id, givingAllowance: { $gte: input.points } },
        { $inc: { givingAllowance: -input.points } },
        { session, new: true },
      );
      if (!updated) throw new Error("INSUFFICIENT_ALLOWANCE");

      await UserModel.updateOne(
        { _id: recipient._id },
        { $inc: { earnedPoints: input.points } },
        { session },
      );

      const kudosDoc = await KudosModel.create(
        [
          {
            senderId: sender._id,
            recipientId: recipient._id,
            points: input.points,
            message: input.message,
            valueTags: input.tags,
            reactions: {},
          },
        ],
        { session },
      );

      result = {
        id: String(kudosDoc[0]._id),
        recipientName: recipient.name ?? null,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

/* ------------------------------------------------------------------ */
/*  Reactions (atomic)                                                 */
/* ------------------------------------------------------------------ */

export async function addReactionAtomic(
  kudosId: string,
  userId: string,
  reaction: string,
): Promise<Record<string, any>> {
  if (!(await getDb())) throw new Error("Database unavailable");

  const session = await mongoose.startSession();
  try {
    let result: Record<string, number> = {};

    await session.withTransaction(async () => {
      const row = await KudosModel.findById(kudosId).session(session);
      if (!row) throw new Error("KUDOS_NOT_FOUND");

      const current = parseReactions(row.reactions);
      const key = `${userId}:${reaction}`;
      const seen: string[] = current._users
        ? JSON.parse(String(current._users))
        : [];
      if (seen.includes(key)) {
        result = current;
        return;
      }

      const next: Record<string, any> = {
        ...current,
        [reaction]: ((current[reaction] as number) ?? 0) + 1,
        _users: JSON.stringify([...seen, key]),
      };
      await KudosModel.updateOne(
        { _id: kudosId },
        { $set: { reactions: next } },
        { session },
      );
      result = next;
    });

    return result;
  } finally {
    await session.endSession();
  }
}

/* ------------------------------------------------------------------ */
/*  Leaderboard                                                        */
/* ------------------------------------------------------------------ */

export async function getLeaderboard(
  department?: "Engineering" | "Design" | "Marketing" | "Sales",
) {
  if (!(await getDb())) return [];
  const filter: Record<string, unknown> = {};
  if (department) filter.department = department;

  const docs = await UserModel.find(filter)
    .select("name avatar department earnedPoints")
    .sort({ earnedPoints: -1, name: 1 })
    .limit(10)
    .lean();

  return docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    avatar: d.avatar,
    department: d.department,
    earnedPoints: d.earnedPoints,
  }));
}

/* ------------------------------------------------------------------ */
/*  Profile stats                                                      */
/* ------------------------------------------------------------------ */

export async function getProfileStats(userId: string) {
  if (!(await getDb()))
    return { sent: 0, received: 0, badges: [] as string[] };

  const oid = new mongoose.Types.ObjectId(userId);
  const sent = await KudosModel.countDocuments({ senderId: oid });
  const received = await KudosModel.countDocuments({ recipientId: oid });
  return {
    sent,
    received,
    badges:
      received >= 5
        ? ["Culture Carrier"]
        : received >= 3
          ? ["Rising Star"]
          : [],
  };
}

/* ------------------------------------------------------------------ */
/*  Admin: reset allowances                                            */
/* ------------------------------------------------------------------ */

export async function resetAllowances() {
  if (!(await getDb())) return 0;
  const result = await UserModel.updateMany({}, { $set: { givingAllowance: 100 } });
  return result.modifiedCount;
}

/* ------------------------------------------------------------------ */
/*  Type helpers (maps Mongoose lean doc → plain object with `id`)     */
/* ------------------------------------------------------------------ */

function toUser(doc: Record<string, any>): User {
  return {
    ...doc,
    id: String(doc._id),
  } as User;
}

export type FeedItem = Awaited<ReturnType<typeof getFeed>>["rows"][number];
export type LeaderboardRow = Awaited<ReturnType<typeof getLeaderboard>>[number];
export type UserRecord = ReturnType<typeof toUser>;
export type KudosRecord = Awaited<ReturnType<typeof getFeed>>["rows"][number];
