import { Hono } from "hono";

const api = new Hono();

api.get("/me", async (c) => {
  const { id, username } = c.get("user");
  return c.json({ id, username });
});

export default api;
