import mongoose from "mongoose";
export function requireDatabase(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: "Banco de dados indisponível. Configure a conexão do MongoDB Atlas e tente novamente." });
  }
  return next();
}
