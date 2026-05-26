import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./configs/db";
import authRoutes from "./routes/auth.routes";
import registryRoutes from "./routes/registry.routes";

const app = express();

const allowedOrigins = [
  "https://medalliance-frontend.vercel.app",
  "https://global-maa-backend-app-vwh5.vercel.app",
  "https://globalmaa.com",
  "https://www.globalmaa.com",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
  })
);

// 🔥 must-have
app.options("/*", cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/registry", registryRoutes);

app.get("/", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      message: "Server is running & DB connected",
    });
  } catch (error) {
    res.status(500).json({
      message: "DB connection failed",
      error,
    });
  }
});

app.get("/check", (req, res) => {
  res.json({ route: "working" });
});

export default app;
