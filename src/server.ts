import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma , connectDB} from "./configs/db";
import authRoutes from "./routes/auth.routes";
import registryRoutes from "./routes/registry.routes";


const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use(
  cors({
    origin: [
      "https://medalliance-frontend.vercel.app",
      "https://globalmaa.com",
      "https://www.globalmaa.com",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/registry", registryRoutes);

const PORT = process.env.PORT || 5000;

// Health check
app.get("/", async (req, res) => {
  try {
    // simple DB check
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      message: "Server is running & DB connected ✅",
    });
  } catch (error) {
    res.status(500).json({
      message: "DB connection failed ❌",
      error,
    });
  }
});

app.get("/check", (req, res) => {
  res.json({ route: "working" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
