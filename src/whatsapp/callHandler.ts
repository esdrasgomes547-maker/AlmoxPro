import type { WASocket } from "@whiskeysockets/baileys";
import { config } from "../config";
import { logger } from "../logger";
import { addMessage } from "../memory/store";

/**
 * Ligações não podem ser atendidas por bots. Rejeitamos e respondemos
 * na hora com uma mensagem educada pedindo áudio/texto.
 */
export function registerCallHandler(sock: WASocket): void {
  sock.ev.on("call", async (calls) => {
    for (const call of calls) {
      if (call.status !== "offer") continue;
      try {
        await sock.rejectCall(call.id, call.from);
        const text =
          `Oi! Aqui é o ${config.botName}, assistente do ${config.ownerName}. ` +
          `Ele não pode atender ligação agora 📵 — me manda uma mensagem ou um áudio ` +
          `que eu já te respondo, ou aviso ele se for algo pessoal. 😉`;
        await sock.sendMessage(call.from, { text });
        addMessage(call.from, "model", text);
        logger.info({ from: call.from }, "Ligação rejeitada com resposta automática");
      } catch (err) {
        logger.warn({ err, from: call.from }, "Falha ao tratar ligação");
      }
    }
  });
}
