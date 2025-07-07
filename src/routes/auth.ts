import {
  discordAuth,
  refreshToken,
  revokeToken,
} from "@hono/oauth-providers/discord";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { db } from "../db/connection";
import { sessionsTable, usersTable } from "../db/schema";

const auth = new Hono();

auth.use(
  "/discord/callback",
  discordAuth({
    client_id: process.env.DISCORD_ID!,
    client_secret: process.env.DISCORD_SECRET!,
    scope: ["identify", "email"],
  })
);

auth.get("/discord/callback", async (c) => {
  const token = c.get("token");
  const refreshToken = c.get("refresh-token");
  const user = c.get("user-discord");

  if (!token || !user || !user.id) return c.text("Unauthorized", 401);

  let dbUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.discordId, user.id))
    .then((rows) => rows[0]);

  if (!dbUser) {
    const [insertedUser] = await db
      .insert(usersTable)
      .values({
        discordId: String(user.id),
        username: String(user.username),
      })
      .returning();

    dbUser = insertedUser;
  } else {
    await db
      .update(usersTable)
      .set({
        username: user.username,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, dbUser.id));
  }

  const expiresAt = new Date(Date.now() + (token.expires_in ?? 86400) * 1000);

  let session = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, dbUser.id))
    .then((rows) => rows[0]);

  let sessionId = session?.sessionId;

  if (sessionId) {
    const [updatedSession] = await db
      .update(sessionsTable)
      .set({
        accessToken: token.token,
        refreshToken: refreshToken?.token || "",
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(sessionsTable.sessionId, sessionId))
      .returning();
    sessionId = updatedSession.sessionId;
  } else {
    const [newSession] = await db
      .insert(sessionsTable)
      .values({
        userId: dbUser.id,
        accessToken: token.token,
        refreshToken: refreshToken?.token || "",
        expiresAt,
      })
      .returning();
    sessionId = newSession.sessionId;
  }

  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return c.redirect("http://localhost:4200");
});

auth.get("/discord/refresh", async (c) => {
  const sessionId = getCookie(c, "session_id");

  if (!sessionId) return c.text("Unauthorized", 401);

  const session = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionId, sessionId))
    .then((rows) => rows[0]);

  if (!session) return c.text("Unauthorized", 401);

  const newTokens = await refreshToken(
    process.env.DISCORD_ID!,
    process.env.DISCORD_SECRET!,
    session.refreshToken
  );

  if (!newTokens.access_token) {
    await db
      .delete(sessionsTable)
      .where(eq(sessionsTable.sessionId, sessionId));
    return c.text("Session expired", 401);
  }

  const expiresAt = new Date(
    Date.now() + (newTokens.expires_in ?? 86400) * 1000
  );
  await db
    .update(sessionsTable)
    .set({
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token,
      expiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(sessionsTable.sessionId, sessionId));

  return c.text("Tokens refreshed", 200);
});

auth.get("/discord/logout", async (c) => {
  const sessionId = getCookie(c, "session_id");

  if (!sessionId) return c.text("Unauthorized", 401);

  const session = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionId, sessionId))
    .then((rows) => rows[0]);

  if (!session) return c.text("Unauthorized", 401);

  const revoked = await revokeToken(
    process.env.DISCORD_ID!,
    process.env.DISCORD_SECRET!,
    session.accessToken
  );

  await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, sessionId));

  deleteCookie(c, "session_id");

  return c.text(`Token revoked ${revoked}`, 200);
});

export default auth;
