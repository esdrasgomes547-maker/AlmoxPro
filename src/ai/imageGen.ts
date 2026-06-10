import { ai } from "./gemini";
import { config } from "../config";
import { logger } from "../logger";

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

export async function generateImage(prompt: string): Promise<GeneratedImage | null> {
  try {
    const res = await ai().models.generateContent({
      model: config.imageModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    for (const part of res.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return {
          buffer: Buffer.from(part.inlineData.data, "base64"),
          mimeType: part.inlineData.mimeType ?? "image/png",
        };
      }
    }
    logger.warn("Geração de imagem não retornou imagem");
    return null;
  } catch (err) {
    logger.warn({ err }, "Falha ao gerar imagem");
    return null;
  }
}
