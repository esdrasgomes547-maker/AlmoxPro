import "dotenv/config";
import path from "path";

function bool(v: string | undefined, def: boolean): boolean {
  if (v === undefined || v === "") return def;
  return ["1", "true", "sim", "yes", "on"].includes(v.trim().toLowerCase());
}

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  botName: process.env.BOT_NAME ?? "Lev",
  ownerName: process.env.OWNER_NAME ?? "meu chefe",
  trigger: (process.env.TRIGGER ?? "@LB").toLowerCase(),
  dataDir: process.env.DATA_DIR ?? path.resolve("data"),
  replyToGroups: bool(process.env.REPLY_TO_GROUPS, false),
  voiceReplies: bool(process.env.VOICE_REPLIES, true),
  ttsVoice: process.env.TTS_VOICE ?? "Kore",
  chatModel: process.env.CHAT_MODEL ?? "gemini-2.5-flash",
  ttsModel: process.env.TTS_MODEL ?? "gemini-2.5-flash-preview-tts",
  imageModel: process.env.IMAGE_MODEL ?? "gemini-2.5-flash-image",
  logLevel: process.env.LOG_LEVEL ?? "info",
  historyLimit: 30,
  maxMediaBytes: 15 * 1024 * 1024,
};

export function validateConfig(): void {
  if (!config.geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY não definida. Crie um arquivo .env (copie o .env.example) e cole sua chave de https://aistudio.google.com/apikey"
    );
  }
}
