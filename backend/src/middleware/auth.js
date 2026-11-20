import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ success: false, message: "Faça login para continuar." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-only-change-this-secret");
    req.user = { id: payload.sub };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Sessão inválida ou expirada. Entre novamente." });
  }
}
