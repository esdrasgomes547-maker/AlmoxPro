import { spawn } from "child_process";
import { ai } from "./gemini";
import { config } from "../config";
import { logger } from "../logger";

/**
 * Converte PCM bruto (s16le, 24 kHz, mono — formato de saída do TTS do Gemini)
 * para OGG/Opus, o formato de nota de voz do WhatsApp.
 */
function pcmToOggOpus(pcm: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-f", "s16le",
      "-ar", "24000",
      "-ac", "1",
      "-i", "pipe:0",
      "-c:a", "libopus",
      "-b:a", "32k",
      "-ar", "48000",
      "-f", "ogg",
      "pipe:1",
    ]);
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    ff.stdout.on("data", (c) => chunks.push(c));
    ff.stderr.on("data", (c) => errChunks.push(c));
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg saiu com código ${code}: ${Buffer.concat(errChunks).toString()}`));
    });
    ff.stdin.write(pcm);
    ff.stdin.end();
  });
}

export interface VoiceNote {
  ogg: Buffer;
  seconds: number;
}

export async function synthesizeVoice(text: string): Promise<VoiceNote | null> {
  try {
    const res = await ai().models.generateContent({
      model: config.ttsModel,
      contents: [{ role: "user", parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: config.ttsVoice } },
        },
      },
    });
    const b64 = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) {
      logger.warn("TTS não retornou áudio");
      return null;
    }
    const pcm = Buffer.from(b64, "base64");
    const ogg = await pcmToOggOpus(pcm);
    const seconds = Math.max(1, Math.round(pcm.length / (24000 * 2)));
    return { ogg, seconds };
  } catch (err) {
    logger.warn({ err }, "Falha no TTS, caindo para resposta em texto");
    return null;
  }
}
