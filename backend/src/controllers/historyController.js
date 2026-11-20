import Analysis from "../models/Analysis.js";

export async function listHistory(req, res) {
  try {
    const items = await Analysis.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ success: true, history: items.map(item => ({
      id: item._id.toString(), type: item.type, content: item.content, score: item.score,
      risk: item.risk, verdict: item.verdict, indicators: item.indicators, urls: item.urls,
      recommendations: item.recommendations, explanation: item.explanation,
      engine: item.engine, analyzedAt: item.createdAt,
      result: { success: true, score: item.score, risk: item.risk, verdict: item.verdict,
        indicators: item.indicators, urls: item.urls, recommendations: item.recommendations,
        explanation: item.explanation, engine: item.engine, analyzedAt: item.createdAt, type: item.type }
    })) });
  } catch (error) {
    console.error("Erro ao consultar histórico:", error.message);
    return res.status(500).json({ success: false, message: "Não foi possível carregar o histórico." });
  }
}

export async function deleteHistoryItem(req, res) {
  try {
    const deleted = await Analysis.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!deleted) return res.status(404).json({ success: false, message: "Análise não encontrada." });
    return res.json({ success: true });
  } catch {
    return res.status(400).json({ success: false, message: "Identificador de análise inválido." });
  }
}

export async function clearHistory(req, res) {
  try {
    await Analysis.deleteMany({ user: req.user.id });
    return res.json({ success: true });
  } catch (error) {
    console.error("Erro ao limpar histórico:", error.message);
    return res.status(500).json({ success: false, message: "Não foi possível limpar o histórico." });
  }
}
