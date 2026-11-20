"""
ScamShield AI - serviço inicial de análise em Python.
Nesta primeira versão, a classificação é baseada em regras didáticas.
Não é um modelo treinado nem substitui uma verificação oficial.
"""
from fastapi import FastAPI
from pydantic import BaseModel, Field
import re
from datetime import datetime, timezone

app = FastAPI(title="ScamShield AI Engine", version="0.1.0")

class AnalyzeRequest(BaseModel):
    content: str = Field(min_length=5, max_length=10000)

RULES = [
    ("Promessa de dinheiro ou prêmio", r"\b(ganhou|ganhador|prêmio|premio|sorteio|pix premiado)\b", 20),
    ("Urgência ou pressão psicológica", r"\b(urgente|imediatamente|última chance|ultima chance|agora mesmo|expira hoje)\b", 15),
    ("Solicitação de dados pessoais", r"\b(senha|cpf|dados bancários|dados bancarios|token|código de acesso)\b", 25),
    ("Solicitação de pagamento", r"\b(pague|pagamento|transferência|transferencia|depósito|deposito|taxa de liberação|chave pix)\b", 20),
]

def classify(score: int):
    if score >= 70:
        return "ALTO", "Alto risco de golpe"
    if score >= 35:
        return "MEDIO", "Atenção: existem sinais suspeitos"
    return "BAIXO", "Poucos sinais suspeitos encontrados"

@app.get("/health")
def health():
    return {"status": "online", "service": "ScamShield AI Engine"}

@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    indicators = []
    score = 0
    for name, pattern, points in RULES:
        if re.search(pattern, request.content, re.IGNORECASE):
            score += points
            indicators.append({"title": name, "points": points})

    score = min(score, 100)
    risk, verdict = classify(score)
    return {
        "success": True,
        "score": score,
        "risk": risk,
        "verdict": verdict,
        "indicators": indicators,
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
        "notice": "Resultado experimental baseado em regras; não confirma fraude."
    }
