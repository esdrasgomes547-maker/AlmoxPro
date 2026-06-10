import {
  downloadMediaMessage,
  jidNormalizedUser,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import { config } from "../config";
import { logger, baileysLogger } from "../logger";
import { addMessage, isPaused } from "../memory/store";
import { decide, type Decision, type IncomingMedia } from "../ai/gemini";
import { synthesizeVoice } from "../ai/tts";
import { generateImage } from "../ai/imageGen";
import { replyDelayMs, showPresence } from "./humanizer";
import { handleOwnerCommand } from "../commands";

// Processa as mensagens de cada conversa em série para não embaralhar contexto
const chatQueues = new Map<string, Promise<void>>();

function enqueue(chat: string, task: () => Promise<void>): void {
  const prev = chatQueues.get(chat) ?? Promise.resolve();
  const next = prev.then(task).catch((err) => {
    logger.error({ err, chat }, "Erro ao processar mensagem");
  });
  chatQueues.set(chat, next);
}

type Unwrapped = NonNullable<WAMessage["message"]>;

function unwrap(message: Unwrapped): Unwrapped {
  return (
    message.ephemeralMessage?.message ??
    message.viewOnceMessage?.message ??
    message.viewOnceMessageV2?.message ??
    message
  ) as Unwrapped;
}

function extractText(m: Unwrapped): string | undefined {
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    undefined
  );
}

async function extractMedia(
  sock: WASocket,
  msg: WAMessage,
  m: Unwrapped
): Promise<{ media?: IncomingMedia; placeholder?: string }> {
  const mediaMsg = m.audioMessage ?? m.imageMessage ?? m.videoMessage;
  if (!mediaMsg) {
    if (m.stickerMessage) return { placeholder: "[figurinha]" };
    if (m.documentMessage)
      return { placeholder: `[documento: ${m.documentMessage.fileName ?? "arquivo"}]` };
    return {};
  }

  const size = Number(mediaMsg.fileLength ?? 0);
  if (size > config.maxMediaBytes) {
    return { placeholder: "[mídia grande demais para analisar]" };
  }

  const kind: IncomingMedia["kind"] = m.audioMessage
    ? "audio"
    : m.imageMessage
      ? "image"
      : "video";
  const fallbackMime = kind === "audio" ? "audio/ogg" : kind === "image" ? "image/jpeg" : "video/mp4";

  try {
    const buffer = (await downloadMediaMessage(msg, "buffer", {}, {
      logger: baileysLogger,
      reuploadRequest: sock.updateMediaMessage,
    })) as Buffer;
    return {
      media: {
        kind,
        mimeType: (mediaMsg.mimetype ?? fallbackMime).split(";")[0],
        dataBase64: buffer.toString("base64"),
      },
    };
  } catch (err) {
    logger.warn({ err }, "Falha ao baixar mídia");
    return { placeholder: `[${kind === "audio" ? "áudio" : kind === "image" ? "imagem" : "vídeo"} não baixado]` };
  }
}

function selfJid(sock: WASocket): string {
  return jidNormalizedUser(sock.user!.id);
}

async function alertOwner(
  sock: WASocket,
  chatJid: string,
  senderName: string,
  preview: string,
  decision: Decision
): Promise<void> {
  const phone = chatJid.split("@")[0];
  const lines = [
    `🔔 *${config.botName}*: acho melhor VOCÊ responder essa.`,
    "",
    `👤 *${senderName}* (+${phone})`,
    `💬 "${preview}"`,
  ];
  if (decision.transcricao) lines.push(`🎙️ Transcrição: "${decision.transcricao}"`);
  if (decision.motivo) lines.push(`🧠 Motivo: ${decision.motivo}`);
  await sock.sendMessage(selfJid(sock), { text: lines.join("\n") });
}

async function sendReply(
  sock: WASocket,
  chatJid: string,
  decision: Decision,
  asVoice: boolean
): Promise<void> {
  const text = decision.resposta?.trim();

  if (decision.imagem) {
    await showPresence(sock, chatJid, "composing", replyDelayMs(text ?? "imagem"));
    const img = await generateImage(decision.imagem);
    if (img) {
      await sock.sendMessage(chatJid, { image: img.buffer, caption: text || undefined });
      addMessage(chatJid, "model", `${text ?? ""} [enviou imagem: ${decision.imagem}]`.trim());
      return;
    }
    // sem imagem gerada, cai para texto
  }

  if (!text) return;

  if (asVoice && config.voiceReplies) {
    const voice = await synthesizeVoice(text);
    if (voice) {
      await showPresence(sock, chatJid, "recording", Math.min(voice.seconds * 300 + 1200, 6000));
      await sock.sendMessage(chatJid, {
        audio: voice.ogg,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
        seconds: voice.seconds,
      });
      addMessage(chatJid, "model", text);
      return;
    }
  }

  await showPresence(sock, chatJid, "composing", replyDelayMs(text));
  await sock.sendMessage(chatJid, { text });
  addMessage(chatJid, "model", text);
}

async function handleMessage(sock: WASocket, msg: WAMessage): Promise<void> {
  const chatJid = msg.key.remoteJid;
  if (!chatJid) return;
  if (chatJid === "status@broadcast") return;
  if (chatJid.endsWith("@newsletter") || chatJid.endsWith("@broadcast")) return;
  if (!msg.message) return;

  const m = unwrap(msg.message);
  if (m.protocolMessage || m.reactionMessage) return;

  const text = extractText(m);
  const isGroup = chatJid.endsWith("@g.us");
  const fromMe = !!msg.key.fromMe;
  const senderName = msg.pushName || "Contato";

  // ── Mensagens enviadas POR VOCÊ (dono) ───────────────────────────────
  if (fromMe) {
    if (text && (await handleOwnerCommand(sock, chatJid, text))) return;

    const trigger = config.trigger;
    if (text && text.trim().toLowerCase().startsWith(trigger)) {
      const instruction = text.trim().slice(trigger.length).trim();
      if (!instruction) return;
      const decision = await decide({ chatJid, text: instruction, ownerCommand: true });
      addMessage(chatJid, "user", `[${config.ownerName} → ${config.botName}] ${instruction}`, config.ownerName);
      await sendReply(sock, chatJid, { ...decision, acao: "responder" }, false);
      return;
    }

    // registra suas próprias mensagens como contexto da conversa
    if (text && !isGroup) addMessage(chatJid, "model", text);
    return;
  }

  // ── Mensagens recebidas de outras pessoas ────────────────────────────
  if (isGroup && !config.replyToGroups) return;
  if (isPaused(chatJid)) {
    if (text) addMessage(chatJid, "user", text, senderName);
    return;
  }

  const { media, placeholder } = await extractMedia(sock, msg, m);
  if (!text && !media && !placeholder) return;

  try {
    await sock.readMessages([msg.key]);
  } catch {
    // marcar como lida é cosmético
  }

  const decision = await decide({
    chatJid,
    text: text ?? placeholder,
    media,
    senderName,
  });

  // registra o que foi recebido no histórico
  const recorded =
    decision.transcricao && media?.kind === "audio"
      ? `[áudio] ${decision.transcricao}`
      : (text ?? placeholder ?? `[${media?.kind}]`);
  addMessage(chatJid, "user", recorded, senderName);

  logger.info(
    { chat: chatJid, acao: decision.acao, motivo: decision.motivo },
    "Triagem concluída"
  );

  if (decision.acao === "alertar") {
    await alertOwner(sock, chatJid, senderName, recorded, decision);
    return;
  }
  if (decision.acao === "ignorar") return;

  const asVoice = media?.kind === "audio";
  await sendReply(sock, chatJid, decision, asVoice);
}

export function registerMessageHandler(sock: WASocket): void {
  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      const chat = msg.key.remoteJid ?? "unknown";
      enqueue(chat, () => handleMessage(sock, msg));
    }
  });
}
