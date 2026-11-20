import { analyzeContent } from "../services/analyzer.js";
import { analyzeWithGemini } from "../services/gemini.js";
import Analysis from "../models/Analysis.js";

const allowedTypes = new Set(["message", "link", "image"]);

export async function analyzeController(req, res) {
  try {
    const { content, type = "message" } = req.body ?? {};
    if (typeof content !== "string" || !content.trim()) return res.status(400).json({ success: false, message: "Informe um conteúdo válido para análise." });
    const cleanContent = content.trim();
    if (cleanContent.length < 5) return res.status(400).json({ success: false, message: "O conteúdo precisa ter pelo menos 5 caracteres." });
    if (cleanContent.length > 10000) return res.status(413).json({ success: false, message: "O conteúdo ultrapassa o limite de 10.000 caracteres." });
    if (!allowedTypes.has(type)) return res.status(400).json({ success: false, message: "Tipo inválido. Use message, link ou image." });

    let contentToAnalyze = cleanContent;
    if (type === "link" && !/^https?:\/\//i.test(contentToAnalyze)) contentToAnalyze = `https://${contentToAnalyze}`;

    const rulesResult = analyzeContent(contentToAnalyze);
    let aiResult = null;
    let aiError = null;
    if (process.env.GEMINI_API_KEY) {
      try { aiResult = await analyzeWithGemini(contentToAnalyze, type); }
      catch (error) {
        aiError = error.message;
        console.error("Falha na análise Gemini:", error.message);
      }
    }

    // Se a IA estiver configurada e responder, sua leitura contextual é principal.
    // Os indicadores das regras são somados sem duplicar títulos idênticos.
    const base = aiResult || { ...rulesResult, explanation: "Análise realizada pelo mecanismo de regras. Configure GEMINI_API_KEY para habilitar a análise contextual por IA.", engine: "rules" };
    const indicators = [...(base.indicators || [])];
    for (const item of (rulesResult.indicators || [])) {
      if (!indicators.some(existing => existing.title === item.title)) indicators.push(item);
    }
    const finalScore = aiResult ? Math.max(aiResult.score, Math.min(100, Math.round(rulesResult.score * 0.65))) : rulesResult.score;
    const finalRisk = finalScore >= 70 ? "ALTO" : finalScore >= 35 ? "MEDIO" : "BAIXO";
    const result = {
      success: true,
      score: finalScore,
      risk: finalRisk,
      verdict: aiResult && finalRisk !== aiResult.risk ? `Risco ${finalRisk.toLowerCase()}: ${base.verdict}` : base.verdict,
      explanation: base.explanation,
      indicators: indicators.slice(0, 8),
      urls: rulesResult.urls || [],
      recommendations: base.recommendations?.length ? base.recommendations : rulesResult.recommendations,
      analyzedAt: new Date().toISOString(),
      engine: aiResult ? "gemini+rules" : "rules",
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      aiError: aiError ? "A IA não respondeu; foi utilizado o mecanismo alternativo de regras." : undefined,
      type
    };

    const saved = await Analysis.create({
      user: req.user.id, type, content: cleanContent.slice(0, 10000), score: result.score,
      risk: result.risk, verdict: result.verdict, indicators: result.indicators,
      urls: result.urls, recommendations: result.recommendations,
      explanation: result.explanation, engine: result.engine
    });
    return res.status(200).json({ ...result, id: saved._id.toString() });
  } catch (error) {
    console.error("Erro no detector:", error);
    return res.status(500).json({ success: false, message: "Não foi possível analisar o conteúdo. Tente novamente." });
  }
}
