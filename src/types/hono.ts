import { sessionsTable, usersTable } from "../db/schema";

declare module "hono" {
  interface ContextVariableMap {
    session: typeof sessionsTable.$inferSelect;
    user: typeof usersTable.$inferSelect;
  }
}
