import { Hono } from "hono";
import { authMiddleware } from "./middlewares/auth";
import api from "./routes/api";
import auth from "./routes/auth";
import "./types/hono";
import { checkTokens } from "./utility";

checkTokens();

const app = new Hono();

app.route("/", auth);
app.use("/api/*", authMiddleware);
app.route("/api", api);

export default app;
