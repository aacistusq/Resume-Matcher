import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

const corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin && corsOrigin.trim() !== "") {
  const origins = corsOrigin
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(cors({ origin: origins, credentials: true }));
} else {
  // Default: permissive CORS for local/dev. Set CORS_ORIGIN in production.
  app.use(cors());
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
