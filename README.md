# ScamShield AI — versão 2.0

Projeto React + Vite com API Node.js/Express, cadastro/login, MongoDB Atlas e análise contextual com Google Gemini API. A chave da IA e a URI do banco ficam somente no backend.

## O que foi acrescentado

- Cadastro com nome, e-mail e senha; validação de e-mail duplicado.
- Login com token JWT (validade de 7 dias).
- Senhas armazenadas com hash bcrypt; nunca são salvas em texto puro.
- Rotas privadas: cada conta consulta, exclui e limpa somente o próprio histórico.
- MongoDB Atlas para usuários e análises.
- Gemini API para interpretar contexto, intenção, engenharia social e sinais de phishing.
- Motor heurístico preservado como camada complementar e fallback se a IA não responder.
- OCR de imagens continua no navegador; somente o texto extraído é enviado para análise e salvo no histórico.

## Requisitos

- Node.js 20 ou superior
- npm
- Conta MongoDB Atlas com cluster e usuário de banco
- Chave Gemini criada no Google AI Studio

## 1. Configurar MongoDB Atlas

1. Crie uma conta em https://www.mongodb.com/atlas.
2. Crie um cluster gratuito (M0, se disponível na sua região/conta).
3. Em **Database Access**, crie um usuário e senha para a aplicação.
4. Em **Network Access**, permita o IP do ambiente que hospedará a API. Para testes, o Atlas permite adicionar seu IP atual. Evite liberar `0.0.0.0/0` em produção.
5. Clique em **Connect > Drivers** e copie a connection string. Troque `<password>` pela senha do usuário do banco e use o banco `scamshield` no caminho da URI. Se a senha tiver caracteres especiais (como `@`, `#`, `/` ou `:`), faça a codificação URL desses caracteres antes de montar a URI.

## 2. Configurar Gemini

1. Acesse https://aistudio.google.com/.
2. Crie uma API key.
3. Consulte os limites e condições do plano gratuito em https://ai.google.dev/gemini-api/docs/pricing. O gratuito tem cotas e disponibilidade que podem mudar; não é ilimitado.

## 3. Configurar o backend

No terminal, entre na pasta `backend`:

```bash
cd backend
npm install
```

Copie `backend/.env.example` para `backend/.env` e preencha:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173
MONGODB_URI=mongodb+srv://USUARIO:SENHA@SEU_CLUSTER.mongodb.net/scamshield?retryWrites=true&w=majority
JWT_SECRET=gere-um-segredo-longo-aleatorio-e-exclusivo
GEMINI_API_KEY=sua-chave-do-google-ai-studio
GEMINI_MODEL=gemini-3.6-flash
```

Gere um JWT secret forte. Exemplo no PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Nunca compartilhe `backend/.env`, nunca coloque a chave Gemini em variáveis `VITE_` e nunca envie credenciais ao GitHub. O `.gitignore` ignora arquivos `.env`.

Inicie o backend:

```bash
npm run dev
```

Teste `http://localhost:3000/api/health`. A resposta deve indicar `database: "connected"` e `ai: "configured"`.

## 4. Iniciar o frontend

Em outro terminal:

```bash
cd frontend
npm install
```

Se necessário, crie `frontend/.env` com:

```env
VITE_API_URL=http://localhost:3000/api
```

Depois execute:

```bash
npm run dev
```

Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173`.

## 5. Como usar

1. Crie uma conta na tela inicial.
2. Entre com seu e-mail e senha.
3. Faça análise de mensagem, link ou imagem.
4. O resultado será salvo no MongoDB e aparecerá no histórico da conta.
5. Ao entrar em outro navegador/dispositivo, use a mesma conta para consultar o histórico.

## Rotas da API

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| GET | `/api/health` | Não | Estado da API, banco e configuração da IA |
| POST | `/api/auth/register` | Não | Criar conta |
| POST | `/api/auth/login` | Não | Entrar |
| GET | `/api/auth/me` | JWT | Dados do usuário autenticado |
| POST | `/api/analyze` | JWT | Analisar e salvar conteúdo |
| GET | `/api/history` | JWT | Listar histórico do usuário |
| DELETE | `/api/history/:id` | JWT | Excluir uma análise própria |
| DELETE | `/api/history` | JWT | Limpar o histórico próprio |

## Testes

Na pasta `backend`:

```bash
npm test
```

## Hospedagem em nuvem

Para que o projeto funcione sem deixar seu computador ligado, publique o frontend em um host estático e o backend em um serviço de aplicação Node.js. Configure as variáveis do `.env` no painel do serviço de hospedagem, atualize `FRONTEND_URL` com o domínio publicado e `VITE_API_URL` com a URL pública da API. O MongoDB Atlas e Gemini já são serviços em nuvem. Planos gratuitos de hospedagem podem suspender aplicações ociosas ou ter limites.

## Limitações e segurança

- O Gemini pode errar, interpretar mal ou deixar passar golpes. O score é uma estimativa de risco, não uma probabilidade estatística nem prova de fraude.
- O plano gratuito da API possui cotas e pode mudar; chamadas excedentes podem falhar ou exigir plano pago. No nível gratuito, o Google informa que o conteúdo pode ser usado para melhorar produtos; não envie informações sensíveis ou dados pessoais de terceiros.
- Se a chave Gemini não estiver configurada ou a API falhar, o backend usa as regras locais como alternativa e informa o mecanismo utilizado.
- O backend não visita nem expande links encurtados; a avaliação de URL é baseada em características observáveis do endereço.
- A imagem original não é enviada ao servidor: o OCR é feito no navegador e o texto extraído é analisado.
- Evite inserir senhas, códigos de autenticação, dados bancários ou documentos pessoais nas mensagens.
- Antes de uso público, configure HTTPS, um `JWT_SECRET` forte, limites de requisição adequados, política de privacidade e monitoramento.
