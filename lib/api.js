import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDb } from "@/lib/db";
import Membership from "@/models/Membership";
import { WRITE_ROLES, ADMIN_ROLES } from "@/lib/constants";
import { cacheInvalidateHousehold } from "@/lib/cache";
import AuditLog from "@/models/AuditLog";
import validation from "@/lib/validation";

export const { ymd, moneyField, nonNegativeNumberField, nonNegativeIntegerField, addMinorField, oneOf } = validation;

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  return session;
}

export async function requireMembership(userId) {
  await connectDb();
  const membership = await Membership.findOne({ userId }).lean();
  if (!membership) {
    const err = new Error("No household");
    err.status = 403;
    throw err;
  }
  return membership;
}

export function assertRole(membership, roles) {
  if (!roles.includes(membership.role)) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}

export function assertWrite(membership) {
  assertRole(membership, WRITE_ROLES);
}

export function assertAdmin(membership) {
  assertRole(membership, ADMIN_ROLES);
}

export async function parseJson(req, { maxBytes = 64 * 1024 } = {}) {
  const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type && type !== "application/json") {
    const err = new Error("Expected application/json");
    err.status = 415;
    throw err;
  }
  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    const err = new Error("Request body is too large");
    err.status = 413;
    throw err;
  }
  let text;
  try {
    text = await req.text();
  } catch {
    const err = new Error("Invalid JSON");
    err.status = 400;
    throw err;
  }
  if (text.length > maxBytes) {
    const err = new Error("Request body is too large");
    err.status = 413;
    throw err;
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error("Invalid JSON");
    err.status = 400;
    throw err;
  }
}

export function paginate(searchParams) {
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 25) || 25));
  return { page, limit, skip: (page - 1) * limit };
}

export async function audit(membership, userId, action, entity, entityId = "") {
  cacheInvalidateHousehold(String(membership.householdId));
  await AuditLog.create({
    householdId: membership.householdId,
    userId,
    action,
    entity,
    entityId: String(entityId),
  });
}

export function handle(err) {
  const status = err.status || 500;
  const message = status >= 500 ? "Something went wrong" : err.message;
  if (status >= 500) console.error(err);
  return json({ error: message }, status);
}
