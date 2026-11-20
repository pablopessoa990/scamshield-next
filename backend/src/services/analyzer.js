const patterns = [
  { name: "Promessa de dinheiro ou prêmio", regex: /\b(ganhou|ganhador|prêmio|premio|sorteio|dinheiro grátis|dinheiro gratis|renda garantida|pix premiado)\b/i, points: 20 },
  { name: "Urgência ou pressão psicológica", regex: /\b(urgente|imediatamente|última chance|ultima chance|agora mesmo|expira hoje|bloqueio imediato|último aviso|ultimo aviso)\b/i, points: 15 },
  { name: "Solicitação de dados pessoais", regex: /\b(senha|cpf|documento|dados bancários|dados bancarios|código de acesso|codigo de acesso|token|código de segurança|codigo de seguranca)\b/i, points: 25 },
  { name: "Solicitação de pagamento", regex: /\b(pague|pagamento|transferência|transferencia|depósito|deposito|taxa de liberação|taxa de liberacao|chave pix|taxa antecipada)\b/i, points: 20 },
  { name: "Possível falsa representação de empresa", regex: /\b(banco central|suporte bancário|suporte bancario|central de segurança|central de seguranca|conta bloqueada|atualize seu cadastro)\b/i, points: 15 },
  { name: "Promessa de benefício ou vantagem", regex: /\b(auxílio liberado|auxilio liberado|benefício aprovado|beneficio aprovado|empréstimo aprovado|emprestimo aprovado)\b/i, points: 15 },
  { name: "Ameaça de bloqueio ou perda de acesso", regex: /\b(sua conta será bloqueada|sua conta sera bloqueada|perderá o acesso|perdera o acesso|acesso suspenso)\b/i, points: 20 },
  { name: "Pedido de código de verificação", regex: /\b(envie|informe|compartilhe|digite).{0,35}(código|codigo).{0,20}(sms|whatsapp|verificação|verificacao)\b/i, points: 25 }
];

const shorteners = new Set(["bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "rb.gy", "rebrand.ly", "shorturl.at"]);
const suspiciousTlds = new Set(["zip", "mov", "top", "click", "work"]);

function extractUrls(text) {
  const matches = text.match(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi) || [];
  return [...new Set(matches.map((url) => url.replace(/[),.!?;]+$/, "")))];
}

function analyzeUrl(url) {
  let score = 0;
  const indicators = [];

  try {
    const normalized = url.startsWith("www.") ? `https://${url}` : url;
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    const tld = hostname.split(".").pop();

    if (shorteners.has(hostname)) {
      score += 25;
      indicators.push("Link encurtado: o destino final não está visível.");
    }
    if (parsed.protocol !== "https:") {
      score += 10;
      indicators.push("O endereço não utiliza HTTPS.");
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      score += 30;
      indicators.push("O endereço utiliza um IP diretamente em vez de um domínio.");
    }
    if (hostname.includes("xn--")) {
      score += 30;
      indicators.push("O domínio usa codificação internacional que pode esconder caracteres semelhantes.");
    }
    if (hostname.split(".").length > 4) {
      score += 10;
      indicators.push("O domínio possui muitos subdomínios.");
    }
    if (parsed.username || parsed.password) {
      score += 30;
      indicators.push("O endereço contém credenciais antes do domínio.");
    }
    if (suspiciousTlds.has(tld)) {
      score += 10;
      indicators.push("A extensão do domínio merece verificação adicional.");
    }
    if (hostname.length > 45) {
      score += 10;
      indicators.push("O nome do domínio é incomumente longo.");
    }
  } catch {
    score += 25;
    indicators.push("Não foi possível interpretar o endereço informado.");
  }

  return { url, score: Math.min(score, 100), indicators };
}

function getRisk(score) {
  if (score >= 70) return { level: "ALTO", label: "Alto risco: vários sinais suspeitos" };
  if (score >= 35) return { level: "MEDIO", label: "Atenção: existem sinais suspeitos" };
  return { level: "BAIXO", label: "Poucos sinais suspeitos encontrados" };
}

export function analyzeContent(content) {
  const indicators = [];
  let score = 0;

  for (const pattern of patterns) {
    if (pattern.regex.test(content)) {
      score += pattern.points;
      indicators.push({
        title: pattern.name,
        description: "Foi identificado um padrão de texto que pode aparecer em tentativas de golpe.",
        points: pattern.points
      });
    }
  }

  const urls = extractUrls(content).map(analyzeUrl);
  for (const result of urls) {
    if (result.indicators.length > 0) {
      indicators.push({
        title: "Análise de endereço eletrônico",
        description: result.indicators.join(" "),
        points: result.score
      });
      score += Math.min(result.score, 30);
    }
  }

  score = Math.min(score, 100);
  const risk = getRisk(score);
  let recommendations;

  if (score >= 70) {
    recommendations = [
      "Não clique nos links recebidos.",
      "Não forneça senhas ou códigos de autenticação.",
      "Não realize transferências antes de confirmar a solicitação.",
      "Procure os canais oficiais da empresa envolvida."
    ];
  } else if (score >= 35) {
    recommendations = [
      "Verifique a identidade de quem enviou a mensagem.",
      "Confira o domínio dos links sem abri-los.",
      "Não compartilhe informações pessoais sem confirmação."
    ];
  } else {
    recommendations = [
      "As regras atuais não encontraram sinais fortes de fraude.",
      "Continue verificando a origem da mensagem e do link.",
      "Uma pontuação baixa não garante que o conteúdo seja seguro."
    ];
  }

  return {
    success: true,
    score,
    risk: risk.level,
    verdict: risk.label,
    indicators,
    urls,
    recommendations,
    analyzedAt: new Date().toISOString(),
    engine: "heuristic-rules-v1"
  };
}
