# 🤖 LevTheBot

Assistente pessoal de IA para o **seu WhatsApp**, com triagem inteligente de mensagens, respostas humanizadas, áudio com voz, visão de imagens/vídeos e geração de imagens. Construído com [Baileys](https://github.com/WhiskeySockets/Baileys) + [Google Gemini](https://aistudio.google.com).

## ✨ O que ele faz

| Recurso | Como funciona |
|---|---|
| 💬 Mensagens de texto | Lê, mostra "digitando…" por um tempo realista e responde com naturalidade |
| 🧠 Triagem inteligente | **Trivial** (oi, bom dia, papo leve) → responde sozinho • **Pessoal/sério** → NÃO responde e te **alerta** no seu chat "mensagens para mim mesmo" • **Vendas/negócios/informações** → responde sozinho |
| 🫵 Invocação `@LB` (estilo Meta AI) | Em **qualquer conversa**, você (e só você) digita `@LB <pergunta/instrução>` e o Lev responde **citando sua mensagem, identificado como 🤖 Lev** — igual ao @Meta AI. Ex.: `@LB resume essa conversa`, `@LB qual a capital da Austrália?` |
| 💭 Chat direto com o Lev | O chat **"Mensagens para mim mesmo"** vira sua conversa privada com o Lev: toda mensagem sua ali ele responde, sem precisar de @LB — seu ChatGPT dentro do WhatsApp |
| 🎙️ Áudios | Entende áudios recebidos (o Gemini "ouve" direto) e responde com **nota de voz** gerada por IA |
| 🖼️ Imagens e vídeos | Entende fotos e vídeos recebidos e comenta/responde sobre eles |
| 🎨 Geração de imagem | Se pedirem "manda uma imagem de X", ele gera e envia |
| 📵 Ligações | Rejeita automaticamente e responde na hora pedindo mensagem/áudio (bots não conseguem atender chamadas de voz — limitação do WhatsApp) |
| ⏸️ Controle total | `/pausar`, `/retomar`, `/status`, `/ajuda` — comandos que só você usa |

## ⚠️ Avisos importantes

- O Baileys é uma biblioteca **não-oficial** (funciona como o WhatsApp Web). O Meta pode, em casos raros, **banir o número** — o risco é baixo em uso pessoal moderado, mas existe. **Não use para spam ou disparo em massa.**
- A camada **grátis** do Gemini tem limite de requisições por dia — suficiente para uso pessoal. Se precisar de mais, ative o billing no Google AI Studio.

## 🚀 Como rodar

### 1. Pegue sua chave do Gemini (grátis)

1. Acesse <https://aistudio.google.com/apikey>
2. Entre com sua conta Google → **Create API key**
3. Copie a chave

### 2. Configure

```bash
git clone https://github.com/SEU_USUARIO/LevTheBot.git
cd LevTheBot
cp .env.example .env
# edite o .env: cole sua GEMINI_API_KEY e ajuste OWNER_NAME, BOT_NAME etc.
```

### 3. Suba com Docker (recomendado)

```bash
docker compose up --build
```

Na primeira vez, um **QR code** aparece no terminal. No celular: **WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho** e escaneie. A sessão fica salva na pasta `data/` — não precisa escanear de novo.

Depois de parear, rode em segundo plano:

```bash
docker compose up -d
docker compose logs -f   # ver os logs / alertas
```

### Rodar sem Docker (alternativa)

Requisitos: Node.js 20+ e `ffmpeg` instalado (`sudo apt install ffmpeg`).

```bash
npm install
npm run build
npm start
```

## 🕹️ Usando no dia a dia

- **Deixe rolar**: ele responde o trivial e os assuntos de negócio sozinho.
- **Alertas**: quando algo for pessoal/sério, ele NÃO responde e te manda um alerta no chat **"Mensagens para mim mesmo"** com o resumo/transcrição para você assumir.
- **`@LB <instrução>`** em qualquer conversa (inclusive grupos): ele lê o histórico daquela conversa e executa o que você pedir. A resposta é enviada na própria conversa.
- **Comandos** (digite em qualquer conversa; no chat consigo mesmo valem globalmente):
  - `/pausar` · `/retomar` · `/status` · `/ajuda`
- **Personalidade**: edite `prompts/persona.md` e reinicie (`docker compose restart`).

## ☁️ Deploy em VPS (24/7)

Qualquer VPS barata com Docker serve (Hetzner, Oracle Cloud Free, Contabo, DigitalOcean…):

```bash
# na VPS
git clone https://github.com/SEU_USUARIO/LevTheBot.git && cd LevTheBot
cp .env.example .env && nano .env          # cole a chave do Gemini
docker compose up --build                  # escaneie o QR que aparece no log
# Ctrl+C depois de conectar, então:
docker compose up -d                       # roda para sempre (reinicia sozinho)
```

> Plataformas sem disco persistente (Heroku, etc.) não servem bem: a sessão do WhatsApp precisa da pasta `data/` persistida.

## 🔧 Estrutura

```
src/
├── index.ts                  # inicialização
├── config.ts                 # variáveis de ambiente
├── commands.ts               # /pausar, /retomar, /status, /ajuda
├── whatsapp/
│   ├── connection.ts         # conexão Baileys, QR code, reconexão
│   ├── messageHandler.ts     # roteia mensagens, triagem, @LB
│   ├── callHandler.ts        # rejeita ligações com resposta automática
│   └── humanizer.ts          # "digitando…", delays realistas
├── ai/
│   ├── gemini.ts             # chat multimodal + triagem (JSON)
│   ├── tts.ts                # texto → voz → OGG/Opus (nota de voz)
│   └── imageGen.ts           # geração de imagens
└── memory/store.ts           # SQLite: histórico por conversa, pausas
```
