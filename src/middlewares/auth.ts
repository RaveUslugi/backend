import { eq } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { db } from "../db/connection";
import { sessionsTable, usersTable } from "../db/schema";

export const authMiddleware = createMiddleware(async (c, next) => {
  const sessionId = getCookie(c, "session_id");

  if (!sessionId) return c.text("Unauthorized", 401);

  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionId, sessionId))
    .limit(1);

  const session = sessions[0];
  if (!session) {
    return c.text("Invalid session", 401);
  }

  const now = new Date();
  if (session.expiresAt < now) {
    return c.text("Session expired", 401);
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);

  const user = users[0];
  if (!user) {
    return c.text("User not found", 401);
  }

  c.set("session", session);
  c.set("user", user);

  await next();
});
