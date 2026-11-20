import React, { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck, LayoutDashboard, MessageSquareText, Link2, Image as ImageIcon,
  History, Bell, Menu, X, AlertTriangle, CheckCircle2, ShieldAlert,
  ArrowRight, ScanSearch, LoaderCircle, LockKeyhole, UploadCloud,
  Trash2, ExternalLink, FileSearch, Clock3, Home, LogOut, UserRound, BrainCircuit
} from "lucide-react";
import { createWorker } from "tesseract.js";
import { analyzeMessage, checkApiHealth, registerUser, loginUser, getCurrentUser, getHistory, deleteHistory, clearRemoteHistory } from "./services/api";
import "./style.css";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "message", label: "Mensagens", icon: MessageSquareText },
  { id: "link", label: "Verificar links", icon: Link2 },
  { id: "image", label: "Analisar imagens", icon: ImageIcon },
  { id: "history", label: "Histórico", icon: History }
];

function App() {
  const [page, setPage] = useState("dashboard");
  const [content, setContent] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [apiOnline, setApiOnline] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [databaseOnline, setDatabaseOnline] = useState(false);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      const token = localStorage.getItem("scamshield-token");
      if (!token) { if (active) setAuthLoading(false); return; }
      try {
        const [profile, savedHistory] = await Promise.all([getCurrentUser(), getHistory()]);
        if (active) { setUser(profile.user); setHistory(savedHistory); }
      } catch {
        localStorage.removeItem("scamshield-token");
        if (active) { setUser(null); setHistory([]); }
      } finally { if (active) setAuthLoading(false); }
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  async function handleAuthenticated(data) {
    localStorage.setItem("scamshield-token", data.token);
    setUser(data.user);
    try { setHistory(await getHistory()); } catch { setHistory([]); }
  }

  function handleLogout() {
    localStorage.removeItem("scamshield-token");
    setUser(null); setHistory([]); setResult(null); setContent(""); setPage("dashboard");
  }

  useEffect(() => {
    let active = true;
    const verifyApi = async () => {
      try {
        const health = await checkApiHealth();
        if (active) { setApiOnline(true); setAiConfigured(health.ai === "configured"); setDatabaseOnline(health.database === "connected"); }
      } catch {
        if (active) { setApiOnline(false); setAiConfigured(false); setDatabaseOnline(false); }
      }
    };
    verifyApi();
    const intervalId = window.setInterval(verifyApi, 15000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  if (authLoading) return <div className="auth-loading"><div className="auth-spinner" /><p>Verificando sua sessão...</p></div>;
  if (!user) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  const current = navigation.find(item => item.id === page) || navigation[0];
  const pageTitles = {
    dashboard: "Painel de segurança",
    message: "Analisar mensagens",
    link: "Verificar links",
    image: "Analisar imagens",
    history: "Histórico de análises"
  };

  function navigate(nextPage) {
    setPage(nextPage);
    setResult(null);
    setError("");
    setMenuOpen(false);
    if (nextPage !== "image") setOcrStatus("");
  }

  async function runAnalysis(text, type) {
    if (!text || text.trim().length < 5) {
      setError("Informe pelo menos 5 caracteres para realizar a análise.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setResult(null);
      const data = await analyzeMessage(text.trim(), type);
      setResult(data);
      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type,
        content: text.trim().slice(0, 500),
        score: data.score,
        risk: data.risk,
        verdict: data.verdict,
        analyzedAt: data.analyzedAt || new Date().toISOString(),
        result: data
      };
      setHistory(old => [entry, ...old].slice(0, 100));
      try { setHistory(await getHistory()); } catch { /* a análise já foi salva no servidor */ }
    } catch (err) {
      setError(err.response?.data?.message || "Não foi possível conectar à API. Confira se o backend está iniciado.");
    } finally {
      setLoading(false);
    }
  }

  function handleAnalyze() {
    if (page === "link") {
      const candidate = content.trim();
      const normalized = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
      try {
        new URL(normalized);
        runAnalysis(normalized, "Link");
      } catch {
        setError("Informe um endereço válido, por exemplo: https://exemplo.com");
      }
      return;
    }
    runAnalysis(content, "Mensagem");
  }

  function loadExample() {
    setContent(page === "link"
      ? "https://bit.ly/premio-gratis"
      : "Parabéns! Você foi selecionado para receber R$ 5.000. Para liberar seu prêmio, pague uma taxa imediatamente pelo link https://bit.ly/premio");
    setResult(null);
    setError("");
  }

  function clearAnalysis() {
    setContent("");
    setResult(null);
    setError("");
  }

  async function handleImage(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem válido.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 10 MB.");
      return;
    }
    setSelectedImage(URL.createObjectURL(file));
    setResult(null);
    setError("");
    setOcrStatus("Preparando leitura da imagem...");
    setOcrLoading(true);
    let worker;
    try {
      worker = await createWorker("por");
      setOcrStatus("Lendo o texto da imagem...");
      const { data } = await worker.recognize(file);
      const extracted = (data.text || "").trim();
      if (extracted.length < 5) {
        setError("Não encontramos texto suficiente na imagem. Envie um print mais nítido ou tente outra imagem.");
        setOcrStatus("Leitura concluída, mas nenhum texto útil foi encontrado.");
        return;
      }
      setContent(extracted);
      setOcrStatus("Texto extraído. Analisando possíveis sinais de golpe...");
      await runAnalysis(extracted, "Imagem (texto OCR)");
      setOcrStatus("Leitura e análise concluídas.");
    } catch (err) {
      setError("Não foi possível ler essa imagem. Tente novamente com uma imagem mais nítida.");
      setOcrStatus("Falha na leitura da imagem.");
    } finally {
      if (worker) await worker.terminate();
      setOcrLoading(false);
    }
  }

  function openHistoryItem(item) {
    setPage(item.type.toLowerCase().includes("link") ? "link" : (item.type.toLowerCase().includes("imagem") || item.type.toLowerCase().includes("image")) ? "image" : "message");
    setContent(item.content);
    setResult(item.result);
    setError("");
    setMenuOpen(false);
  }

  async function deleteHistoryItem(id) {
    try { await deleteHistory(id); setHistory(old => old.filter(item => item.id !== id)); }
    catch { setError("Não foi possível excluir essa análise no banco de dados."); }
  }

  async function clearHistory() {
    if (window.confirm("Deseja apagar todo o seu histórico na nuvem?")) {
      try { await clearRemoteHistory(); setHistory([]); }
      catch { setError("Não foi possível limpar o histórico na nuvem."); }
    }
  }

  const isHighRisk = result?.risk === "ALTO";
  const isMediumRisk = result?.risk === "MEDIO";

  return (
    <div className="app">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><ShieldCheck size={25} /></div>
          <div><h2>ScamShield</h2><span>AI SECURITY</span></div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <div className="nav-section">
          <span className="nav-title">MENU PRINCIPAL</span>
          <nav>
            {navigation.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => navigate(id)}>
                <Icon size={19} />{label}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="security-card">
            <ShieldCheck size={22} />
            <strong>Proteção inteligente</strong>
            <p>Identifique possíveis ameaças digitais antes que seja tarde.</p>
            <span>SCAMSHIELD AI v1.1</span>
          </div>
        </div>
      </aside>

      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
      <main className="main">
        <header className="topbar">
          <div className="header-left">
            <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={23} /></button>
            <div><span className="breadcrumb">Segurança / {current.label}</span><h1>{pageTitles[page]}</h1></div>
          </div>
          <div className="header-right">
            <div className={`status ${apiOnline ? "online" : "offline"}`}><span className="status-dot"></span>{apiOnline ? "Backend conectado" : "Backend desconectado"}</div>
            <div className="user-chip"><div className="avatar"><UserRound size={17} /></div><span>{user.name}</span><button className="logout-button" onClick={handleLogout} title="Sair"><LogOut size={17} /></button></div>
          </div>
        </header>

        {page === "dashboard" && (
          <>
            <section className="welcome">
              <div><h2>Olá, {user.name.split(" ")[0]}!</h2><p>Suas análises ficam salvas na sua conta e sincronizadas na nuvem.</p></div>
              <div className="welcome-icon"><ShieldCheck size={38} /></div>
            </section>
            <section className="stats-grid">
              <div className="stat-card"><div className="stat-icon blue"><ScanSearch size={22} /></div><div><span>Motor de análise</span><h3>Ativo</h3><small>{aiConfigured ? "Gemini + regras" : "IA não configurada"}</small></div></div>
              <div className="stat-card"><div className="stat-icon green"><ShieldCheck size={22} /></div><div><span>Análises realizadas</span><h3>{history.length}</h3><small>Salvas na nuvem</small></div></div>
              <div className="stat-card"><div className="stat-icon purple"><LockKeyhole size={22} /></div><div><span>Privacidade</span><h3>{databaseOnline ? "Conectado" : "Indisponível"}</h3><small>Banco de dados na nuvem</small></div></div>
            </section>
            <section className="quick-grid">
              <button className="quick-card" onClick={() => navigate("message")}><div className="quick-icon blue"><MessageSquareText size={23} /></div><strong>Analisar mensagem</strong><p>Verifique SMS, WhatsApp e e-mails suspeitos.</p><span>Começar análise <ArrowRight size={16} /></span></button>
              <button className="quick-card" onClick={() => navigate("link")}><div className="quick-icon green"><Link2 size={23} /></div><strong>Verificar link</strong><p>Procure características comuns em links suspeitos.</p><span>Verificar agora <ArrowRight size={16} /></span></button>
              <button className="quick-card" onClick={() => navigate("image")}><div className="quick-icon purple"><ImageIcon size={23} /></div><strong>Analisar imagem</strong><p>Envie um print para extrair e analisar o texto.</p><span>Enviar imagem <ArrowRight size={16} /></span></button>
              <button className="quick-card" onClick={() => navigate("history")}><div className="quick-icon orange"><History size={23} /></div><strong>Ver histórico</strong><p>Consulte os resultados das análises anteriores.</p><span>Abrir histórico <ArrowRight size={16} /></span></button>
            </section>
          </>
        )}

        {(page === "message" || page === "link" || page === "image") && (
          <section className="tool-layout">
            <div className="analysis-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-label"><ScanSearch size={16} />FERRAMENTA DE VERIFICAÇÃO</div>
                  <h2>{page === "message" ? "Análise de mensagens" : page === "link" ? "Verificação de links" : "Análise de imagens"}</h2>
                  <p>{page === "message" ? "Cole o conteúdo recebido por SMS, WhatsApp, redes sociais ou e-mail." : page === "link" ? "Cole o endereço completo do site que deseja verificar." : "Envie um print ou imagem. O sistema tentará extrair o texto e analisar sinais suspeitos."}</p>
                </div>
                <div className="analysis-icon"><ShieldCheck size={27} /></div>
              </div>

              {page === "image" && (
                <div className="upload-area">
                  <label className="upload-label" htmlFor="image-upload">
                    <UploadCloud size={30} />
                    <strong>Escolher imagem</strong>
                    <span>PNG, JPG ou WEBP • até 10 MB</span>
                    <input id="image-upload" type="file" accept="image/*" onChange={e => handleImage(e.target.files?.[0])} />
                  </label>
                  {selectedImage && <img className="image-preview" src={selectedImage} alt="Pré-visualização da imagem enviada" />}
                  {ocrStatus && <p className="ocr-status">{ocrLoading && <LoaderCircle className="spin" size={15} />}{ocrStatus}</p>}
                </div>
              )}

              {page !== "image" && (
                <>
                  <div className="input-label"><label htmlFor="content-input">{page === "link" ? "Endereço do link" : "Mensagem ou texto suspeito"}</label><span>{content.length}/10000</span></div>
                  <textarea id="content-input" value={content} maxLength={10000} onChange={e => { setContent(e.target.value); setError(""); }} placeholder={page === "link" ? "https://exemplo.com ou cole o link recebido..." : "Cole aqui a mensagem suspeita..."} />
                  <div className="input-footer"><span><BrainCircuit size={14} />Análise contextual por IA e regras de segurança.</span><button className="example-button" onClick={loadExample}>Usar exemplo</button></div>
                </>
              )}

              {page === "image" && content && (
                <div className="ocr-extracted"><strong><FileSearch size={16} /> Texto identificado na imagem</strong><p>{content}</p></div>
              )}
              {error && <div className="error-message"><AlertTriangle size={17} />{error}</div>}
              <div className="action-buttons">
                {page !== "image" ? (
                  <button className="analyze-button" onClick={handleAnalyze} disabled={loading}>
                    {loading ? <><LoaderCircle className="spin" size={19} />Analisando...</> : <><ShieldCheck size={19} />{page === "link" ? "Verificar link" : "Analisar mensagem"}<ArrowRight size={18} /></>}
                  </button>
                ) : (
                  <button className="analyze-button" onClick={() => runAnalysis(content, "Imagem (texto OCR)")} disabled={loading || ocrLoading || !content}>
                    {loading ? <><LoaderCircle className="spin" size={19} />Analisando...</> : <><ShieldCheck size={19} />Analisar texto extraído<ArrowRight size={18} /></>}
                  </button>
                )}
                <button className="clear-button" onClick={clearAnalysis}>Limpar</button>
              </div>
              {page === "image" && <p className="privacy-note">A leitura OCR acontece no navegador. Na primeira utilização, o idioma português pode precisar ser baixado da internet.</p>}
            </div>
            <ResultPanel result={result} />
          </section>
        )}

        {page === "history" && (
          <section className="history-panel">
            <div className="history-heading"><div><span className="section-label"><Clock3 size={15} />HISTÓRICO NA NUVEM</span><h2>Análises recentes</h2><p>Seus registros são privados e vinculados à sua conta.</p></div>
              {history.length > 0 && <button className="clear-history" onClick={clearHistory}><Trash2 size={16} />Limpar histórico</button>}
            </div>
            {history.length === 0 ? (
              <div className="empty-result history-empty"><div className="empty-icon"><History size={38} /></div><h3>Nenhuma análise registrada</h3><p>Quando você analisar uma mensagem, link ou imagem, o resultado aparecerá aqui.</p><button className="secondary-action" onClick={() => navigate("message")}>Fazer primeira análise</button></div>
            ) : (
              <div className="history-list">
                {history.map(item => (
                  <div className="history-item" key={item.id}>
                    <div className={`history-risk ${item.risk === "ALTO" ? "risk-high" : item.risk === "MEDIO" ? "risk-medium" : "risk-low"}`}>{item.risk}</div>
                    <div className="history-details"><strong>{item.type}</strong><p>{item.content}</p><span>{new Date(item.analyzedAt).toLocaleString("pt-BR")}</span></div>
                    <div className="history-score">{item.score}/100</div>
                    <button className="icon-action" title="Abrir resultado" onClick={() => openHistoryItem(item)}><ExternalLink size={17} /></button>
                    <button className="icon-action danger" title="Excluir registro" onClick={() => deleteHistoryItem(item.id)}><Trash2 size={17} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <footer><span>© 2026 ScamShield AI</span><span>Protótipo acadêmico • Análise automatizada não garante segurança.</span></footer>
      </main>
    </div>
  );
}

function ResultPanel({ result }) {
  const isHighRisk = result?.risk === "ALTO";
  const isMediumRisk = result?.risk === "MEDIO";
  return (
    <div className="result-panel">
      <div className="result-heading"><div><span className="section-label">RESULTADO</span><h2>Diagnóstico</h2></div><ShieldCheck size={25} /></div>
      {!result ? (
        <div className="empty-result"><div className="empty-icon"><ScanSearch size={39} /></div><h3>Aguardando análise</h3><p>O resultado da verificação aparecerá aqui, com pontuação, sinais identificados e recomendações.</p><div className="empty-security"><LockKeyhole size={16} />Análise de segurança</div></div>
      ) : (
        <div className="result-content">
          <div className={`risk-box ${isHighRisk ? "risk-high" : isMediumRisk ? "risk-medium" : "risk-low"}`}>
            {isHighRisk ? <ShieldAlert size={28} /> : isMediumRisk ? <AlertTriangle size={28} /> : <CheckCircle2 size={28} />}
            <div><strong>{result.verdict}</strong><span>Nível de risco: {result.risk}</span></div>
          </div>
          <div className="score-container"><div className="score-header"><span>Pontuação de risco</span><strong>{result.score}/100</strong></div><div className="progress-track"><div className={`progress-fill ${isHighRisk ? "fill-high" : isMediumRisk ? "fill-medium" : "fill-low"}`} style={{ width: `${result.score}%` }} /></div><div className="score-legend"><span>Baixo</span><span>Médio</span><span>Alto</span></div></div>
          {result.explanation && <div className="ai-explanation"><div><BrainCircuit size={17} /> Análise contextual</div><p>{result.explanation}</p><small>Mecanismo: {result.engine === "gemini+rules" ? "Gemini + regras" : result.engine === "gemini" ? "Gemini" : "Regras alternativas"}</small></div>}
          <div className="result-section"><h4>Sinais identificados</h4>{result.indicators?.length ? result.indicators.map((item, index) => <div className="indicator" key={index}><AlertTriangle size={17} /><div><strong>{item.title}</strong><p>{item.description}</p></div></div>) : <p className="no-indicators">Nenhum padrão suspeito foi identificado pelas regras atuais.</p>}</div>
          {result.urls?.length > 0 && <div className="result-section"><h4>Links encontrados</h4>{result.urls.map((url, index) => <div className="url-result" key={index}><Link2 size={16} /><div><strong>{url.url}</strong><p>Risco estimado: {url.score}/100</p></div></div>)}</div>}
          <div className="result-section"><h4>Recomendações</h4>{result.recommendations?.map((item, index) => <div className="recommendation" key={index}><CheckCircle2 size={16} /><span>{item}</span></div>)}</div>
          <div className="disclaimer"><AlertTriangle size={16} />Esta análise é automatizada e não comprova a existência ou ausência de fraude.</div>
        </div>
      )}
    </div>
  );
}


function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault(); setError("");
    if (mode === "register" && password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    setBusy(true);
    try {
      const response = mode === "register"
        ? await registerUser({ name, email, password })
        : await loginUser({ email, password });
      await onAuthenticated(response);
    } catch (err) {
      setError(err.response?.data?.message || "Não foi possível conectar ao servidor. Verifique se a API e o banco estão configurados.");
    } finally { setBusy(false); }
  }

  return <main className="auth-page">
    <div className="auth-card">
      <div className="auth-brand"><div className="auth-brand-icon"><ShieldCheck size={27} /></div><div><strong>ScamShield AI</strong><span>PROTEÇÃO DIGITAL INTELIGENTE</span></div></div>
      <div className="auth-intro"><span className="auth-kicker">SUA SEGURANÇA COMEÇA AQUI</span><h1>{mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}</h1><p>{mode === "login" ? "Entre para acessar suas análises e seu histórico seguro." : "Cadastre-se para usar a análise inteligente e salvar seu histórico na nuvem."}</p></div>
      <form className="auth-form" onSubmit={submit}>
        {mode === "register" && <label>Nome completo<input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" required minLength={2} maxLength={80} /></label>}
        <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" required /></label>
        <label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={72} /></label>
        {mode === "register" && <label>Confirmar senha<input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Digite a senha novamente" autoComplete="new-password" required minLength={8} maxLength={72} /></label>}
        {error && <div className="error-message"><AlertTriangle size={17} />{error}</div>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} /> Aguarde...</> : mode === "login" ? "Entrar na minha conta" : "Criar conta"}<ArrowRight size={18} /></button>
      </form>
      <div className="auth-switch">{mode === "login" ? "Ainda não tem uma conta?" : "Já possui uma conta?"}<button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}> {mode === "login" ? "Cadastre-se" : "Fazer login"}</button></div>
      <div className="auth-security"><LockKeyhole size={15} /> Suas análises são privadas e vinculadas à sua conta.</div>
    </div>
  </main>;
}

export default App;
