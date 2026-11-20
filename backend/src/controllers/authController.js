import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const secret = () => process.env.JWT_SECRET || "dev-only-change-this-secret";
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email });
const createToken = (user) => jwt.sign({ sub: user._id.toString() }, secret(), { expiresIn: "7d" });

export async function register(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (name.length < 2 || name.length > 80) return res.status(400).json({ success: false, message: "Informe um nome entre 2 e 80 caracteres." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return res.status(400).json({ success: false, message: "Informe um e-mail válido." });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ success: false, message: "A senha deve ter entre 8 e 72 caracteres." });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: "Este e-mail já está cadastrado." });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    return res.status(201).json({ success: true, token: createToken(user), user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "Este e-mail já está cadastrado." });
    console.error("Falha no cadastro:", error.message);
    return res.status(500).json({ success: false, message: "Não foi possível criar a conta." });
  }
}

export async function login(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: "E-mail ou senha incorretos." });
    }
    return res.json({ success: true, token: createToken(user), user: publicUser(user) });
  } catch (error) {
    console.error("Falha no login:", error.message);
    return res.status(500).json({ success: false, message: "Não foi possível entrar na conta." });
  }
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: "Usuário não encontrado." });
  return res.json({ success: true, user: publicUser(user) });
}
