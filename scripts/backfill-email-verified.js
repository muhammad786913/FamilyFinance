/**
 * One-time migration: accounts created before email verification existed would
 * otherwise be locked out. Run once after deploying verification:
 *
 *   npm run verify-backfill
 *
 * Only touches accounts with emailVerifiedAt = null. New signups always get a
 * verification token, so this does not weaken new-account checks.
 */
const mongoose = require("mongoose");

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing");
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await mongoose.connection.db
    .collection("users")
    .updateMany({ emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } });
  console.log(`Marked ${result.modifiedCount} pre-existing account(s) as verified.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
