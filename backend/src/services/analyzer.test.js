import test from "node:test";
import assert from "node:assert/strict";
import { analyzeContent } from "./analyzer.js";

test("retorna estrutura de análise para texto comum", () => {
  const result = analyzeContent("Bom dia, tudo bem com você?");
  assert.equal(result.success, true);
  assert.equal(result.risk, "BAIXO");
  assert.equal(typeof result.score, "number");
  assert.ok(Array.isArray(result.indicators));
  assert.ok(Array.isArray(result.recommendations));
});

test("identifica pressão, prêmio e pedido de pagamento", () => {
  const result = analyzeContent("Parabéns, você ganhou um prêmio. Pague uma taxa imediatamente para liberar o dinheiro.");
  assert.ok(result.score >= 35);
  assert.notEqual(result.risk, "BAIXO");
  assert.ok(result.indicators.length >= 2);
});

test("identifica características suspeitas de link encurtado", () => {
  const result = analyzeContent("Acesse agora https://bit.ly/premio");
  assert.equal(result.urls.length, 1);
  assert.ok(result.urls[0].indicators.some((item) => item.includes("encurtado")));
});

test("limita a pontuação a 100", () => {
  const result = analyzeContent("Você ganhou prêmio, informe seu CPF e senha, pague uma taxa imediatamente, sua conta será bloqueada. Acesse http://192.168.1.10");
  assert.ok(result.score <= 100);
});
