import "dotenv/config";
import mongoose from "mongoose";
import { UserModel, KudosModel } from "../models";

async function seed() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required to seed Kudos Wall.");
    process.exit(1);
  }

  try {
    await mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 5000 });
    console.log("[Seed] Connected to MongoDB");
  } catch (err: any) {
    console.error("[Seed] Failed to connect to MongoDB:", err.message);
    console.error("Tip: Make sure your current IP address is whitelisted in MongoDB Atlas Network Access (e.g. 0.0.0.0/0).");
    process.exit(1);
  }

  const people = [
    { openId: "seed-maya", name: "Maya Patel", email: "maya@northstar.co", department: "Design" as const, avatar: "MP", givingAllowance: 100, earnedPoints: 420 },
    { openId: "seed-priya", name: "Priya Nair", email: "priya@northstar.co", department: "Engineering" as const, avatar: "PN", givingAllowance: 100, earnedPoints: 365 },
    { openId: "seed-sofia", name: "Sofia Chen", email: "sofia@northstar.co", department: "Marketing" as const, avatar: "SC", givingAllowance: 100, earnedPoints: 310 },
    { openId: "seed-jordan", name: "Jordan Lee", email: "jordan@northstar.co", department: "Engineering" as const, avatar: "JL", givingAllowance: 100, earnedPoints: 260 },
    { openId: "seed-owen", name: "Owen Williams", email: "owen@northstar.co", department: "Sales" as const, avatar: "OW", givingAllowance: 100, earnedPoints: 235 },
  ];

  // Upsert each user
  for (const person of people) {
    await UserModel.findOneAndUpdate(
      { openId: person.openId },
      { $set: person },
      { upsert: true, new: true },
    );
  }

  const seeded = await UserModel.find({}).select("_id openId").lean();
  const idFor = (openId: string) => {
    const found = seeded.find((p) => p.openId === openId);
    return found?._id;
  };

  await KudosModel.insertMany([
    { senderId: idFor("seed-jordan"), recipientId: idFor("seed-maya"), points: 50, message: "Maya turned a fuzzy brief into a crisp system that made the whole launch feel easy.", valueTags: ["#Teamwork", "#Innovation"], reactions: { thumbs: 12, party: 4, fire: 7 } },
    { senderId: idFor("seed-owen"), recipientId: idFor("seed-sofia"), points: 20, message: "Sofia stayed close to every customer signal and helped us sharpen the story before the review.", valueTags: ["#CustomerObsession"], reactions: { thumbs: 8, party: 2, fire: 3 } },
    { senderId: idFor("seed-maya"), recipientId: idFor("seed-priya"), points: 50, message: "Priya unblocked the analytics handoff in record time and left the docs better than she found them.", valueTags: ["#Teamwork"], reactions: { thumbs: 19, party: 5, fire: 6 } },
  ]);

  console.log("Seeded Kudos Wall users and recognition activity.");
  await mongoose.disconnect();
}

void seed();
