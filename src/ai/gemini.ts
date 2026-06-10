import { GoogleGenAI, Type, Content } from "@google/genai";
import fs from "fs";
import path from "path";
import { config } from "../config";
import { getHistory } from "../memory/store";
import { logger } from "../logger";

let client: GoogleGenAI | undefined;

export function ai(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: config.geminiApiKey });
  return client;
}

export interface IncomingMedia {
  mimeType: string;
  dataBase64: string;
  kind: "audio" | "image" | "video";
}

export interface DecideInput {
  chatJid: string;
  text?: string;
  media?: IncomingMedia;
  senderName?: string;
  /** true quando o DONO invocou o bot com @LB — sem triagem, sempre responde */
  ownerCommand?: boolean;
}

export interface Decision {
  acao: "responder" | "alertar" | "ignorar";
  resposta?: string;
  motivo?: string;
  transcricao?: string;
  imagem?: string;
}

function loadPersona(): string {
  const personaPath = path.resolve("prompts/persona.md");
  try {
    return fs.readFileSync(personaPath, "utf-8");
  } catch {
    return `Você é ${config.botName}, assistente pessoal de ${config.ownerName} no WhatsApp.`;
  }
}

function systemPrompt(ownerCommand: boolean): string {
  const persona = loadPersona()
    .replaceAll("{BOT_NAME}", config.botName)
    .replaceAll("{OWNER_NAME}", config.ownerName);

  const base = `${persona}

Data e hora atuais: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.

REGRAS DE SAÍDA — responda SEMPRE com um JSON válido com estes campos:
- "acao": "responder" | "alertar" | "ignorar"
- "resposta": o texto da mensagem a enviar (quando acao = "responder"). Escreva como uma pessoa real escreve no WhatsApp: curto, natural, informal, sem parecer robô.
- "motivo": explicação curta (1 frase) da sua decisão.
- "transcricao": se a mensagem recebida for um ÁUDIO, transcreva aqui o que foi dito.
- "imagem": APENAS se a pessoa pediu explicitamente uma imagem/foto/desenho criado, descreva aqui em inglês a imagem a gerar. Caso contrário, omita.`;

  if (ownerCommand) {
    return `${base}

MODO COMANDO DO DONO: ${config.ownerName} (seu dono) te invocou diretamente nesta conversa.
- Use acao = "responder" SEMPRE.
- Execute a instrução dele usando o histórico da conversa como contexto (resumir a conversa, redigir uma resposta para a outra pessoa, responder uma pergunta, etc.).
- A sua resposta será enviada NESTA conversa, então escreva o texto final pronto para ser lido por quem está no chat (a não ser que a instrução seja claramente para o próprio dono, ex.: "resume essa conversa").`;
  }

  return `${base}

TRIAGEM — decida a "acao" com sensatez:
1. "responder": mensagens triviais (cumprimentos, "bom dia", figurinhas, conversa casual leve), perguntas práticas/informativas, e assuntos de vendas/negócios/orçamento/atendimento que você consegue resolver. Responda de forma útil e simpática.
2. "alertar": mensagens PESSOAIS ou direcionadas especificamente a ${config.ownerName} — assuntos íntimos, família, amigos próximos tratando de algo sério, decisões que só ele pode tomar, dinheiro pessoal, urgências, cobranças pessoais, assuntos emocionais ou delicados. NÃO responda no chat; o dono será avisado para responder pessoalmente.
3. "ignorar": correntes, spam, mensagens que não pedem resposta nenhuma.
Na dúvida entre responder e alertar, prefira "alertar" — é melhor o dono responder do que você se meter em assunto pessoal.
Se perguntarem se você é um robô/IA, seja honesto: diga com leveza que é o assistente virtual de ${config.ownerName}.`;
}

const decisionSchema = {
  type: Type.OBJECT,
  properties: {
    acao: { type: Type.STRING, enum: ["responder", "alertar", "ignorar"] },
    resposta: { type: Type.STRING },
    motivo: { type: Type.STRING },
    transcricao: { type: Type.STRING },
    imagem: { type: Type.STRING },
  },
  required: ["acao"],
};

function historyToContents(chatJid: string): Content[] {
  return getHistory(chatJid).map((m) => ({
    role: m.role,
    parts: [{ text: m.role === "user" && m.sender ? `${m.sender}: ${m.content}` : m.content }],
  }));
}

export async function decide(input: DecideInput): Promise<Decision> {
  const contents: Content[] = historyToContents(input.chatJid);

  const parts: Content["parts"] = [];
  if (input.media) {
    parts!.push({
      inlineData: { mimeType: input.media.mimeType, data: input.media.dataBase64 },
    });
  }
  const label = input.ownerCommand
    ? `[INSTRUÇÃO DO DONO] ${input.text ?? ""}`
    : `${input.senderName ?? "Contato"}: ${input.text ?? "(mídia sem legenda)"}`;
  parts!.push({ text: label });
  contents.push({ role: "user", parts });

  const res = await ai().models.generateContent({
    model: config.chatModel,
    contents,
    config: {
      systemInstruction: systemPrompt(!!input.ownerCommand),
      responseMimeType: "application/json",
      responseSchema: decisionSchema,
      temperature: 0.8,
    },
  });

  const raw = res.text ?? "";
  try {
    const parsed = JSON.parse(raw) as Decision;
    if (!parsed.acao) throw new Error("sem acao");
    return parsed;
  } catch (err) {
    logger.warn({ raw, err }, "Resposta do Gemini não era JSON válido, usando fallback");
    // fallback: trata o texto cru como resposta direta
    return { acao: "responder", resposta: raw || undefined };
  }
}
