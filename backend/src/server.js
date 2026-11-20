
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import analyzeRoutes from "./routes/analyzeRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dns from "node:dns";

// Corrige a resolução DNS do MongoDB Atlas no Windows
dns.setServers(["1.1.1.1", "1.0.0.1"]);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const allowedOrigins = (
  process.env.FRONTEND_URL ||
  "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origem não autorizada pelo CORS."));
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "1mb" }));

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Muitas solicitações. Aguarde alguns minutos e tente novamente."
  }
}));

app.get("/", (_req, res) => {
  res.json({
    name: "ScamShield AI API",
    status: "online",
    version: "2.0.0"
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "online",
    service: "scamshield-api",
    database: mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected",
    ai: process.env.GEMINI_API_KEY
      ? "configured"
      : "not_configured",
    timestamp: new Date().toISOString()
  });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Muitas tentativas de autenticação. Aguarde 15 minutos."
  }
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/analyze", analyzeRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Rota não encontrada."
  });
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      success: false,
      message: "JSON inválido."
    });
  }

  if (error.message === "Origem não autorizada pelo CORS.") {
    return res.status(403).json({
      success: false,
      message: error.message
    });
  }

  console.error("Erro inesperado na API:", error);

  return res.status(500).json({
    success: false,
    message: "Erro interno do servidor."
  });
});

// MongoDB
mongoose.connection.on("connected", () => {
  console.log("MongoDB Atlas conectado com sucesso!");
});

mongoose.connection.on("error", error => {
  console.error("Erro MongoDB:", error.message);
});

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log("Banco de dados pronto para uso.");
    })
    .catch(error => {
      console.error(
        "Não foi possível conectar ao MongoDB:",
        error.message
      );
    });
} else {
  console.warn(
    "MONGODB_URI não configurada. Cadastro, login e histórico em nuvem ficarão indisponíveis."
  );
}

// Inicialização compatível com Windows
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.JWT_SECRET
  ) {
    throw new Error("JWT_SECRET precisa ser configurado em produção.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ScamShield API disponível na porta ${PORT}`);
  });
}

export default app;
