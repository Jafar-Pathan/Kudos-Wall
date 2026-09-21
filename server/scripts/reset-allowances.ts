import "dotenv/config";
import mongoose from "mongoose";
import { resetAllowances } from "../db";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      await mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 5000 });
    } catch (err: any) {
      console.error("[Reset Allowances] MongoDB connection failed:", err.message);
      process.exit(1);
    }
  }
  const updated = await resetAllowances();
  console.log(`Reset monthly giving allowances for ${updated} teammates.`);
  await mongoose.disconnect();
}

void main();
