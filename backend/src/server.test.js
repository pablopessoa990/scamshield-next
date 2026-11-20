import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import app from "./server.js";

async function withServer(t, callback) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await callback(`http://127.0.0.1:${server.address().port}`);
}

test("API informa estado do serviço", async t => withServer(t, async baseUrl => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.status, "online");
  assert.ok(["connected", "disconnected"].includes(health.database));
}));

test("API exige autenticação para analisar conteúdo", async t => withServer(t, async baseUrl => {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "Mensagem para análise de segurança", type: "message" })
  });
  assert.ok([401, 503].includes(response.status)); // exige sessão e banco conectado
  const payload = await response.json();
  assert.equal(payload.success, false);
}));
