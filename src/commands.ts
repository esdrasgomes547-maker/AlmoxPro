import type { WASocket } from "@whiskeysockets/baileys";
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { config } from "./config";
import { isPaused, kvGet, setPaused } from "./memory/store";

function selfJid(sock: WASocket): string {
  return jidNormalizedUser(sock.user!.id);
}

/**
 * Comandos enviados pelo DONO (mensagens fromMe começando com "/").
 * No chat "mensagens para mim mesmo" os comandos valem globalmente;
 * em qualquer outra conversa, valem só para aquela conversa.
 * Retorna true se a mensagem era um comando e foi tratada.
 */
export async function handleOwnerCommand(
  sock: WASocket,
  chatJid: string,
  text: string
): Promise<boolean> {
  const cmd = text.trim().toLowerCase();
  if (!cmd.startsWith("/")) return false;

  const isSelfChat = chatJid === selfJid(sock);
  const scope = isSelfChat ? "*" : chatJid;
  const scopeLabel = isSelfChat ? "em TODAS as conversas" : "nesta conversa";

  const reply = (t: string) => sock.sendMessage(chatJid, { text: t });

  if (cmd === "/pausar") {
    setPaused(scope, true);
    await reply(`⏸️ ${config.botName} pausado ${scopeLabel}. Use /retomar para reativar.`);
    return true;
  }
  if (cmd === "/retomar") {
    setPaused(scope, false);
    if (isSelfChat) setPaused("*", false);
    await reply(`▶️ ${config.botName} reativado ${scopeLabel}.`);
    return true;
  }
  if (cmd === "/status") {
    const globalPaused = kvGet("paused:*") === "1";
    const chatPaused = !isSelfChat && isPaused(chatJid);
    await reply(
      [
        `🤖 *${config.botName}* — status`,
        `Global: ${globalPaused ? "⏸️ pausado" : "✅ ativo"}`,
        isSelfChat ? "" : `Esta conversa: ${chatPaused ? "⏸️ pausada" : "✅ ativa"}`,
        `Voz nas respostas: ${config.voiceReplies ? "✅" : "❌"}`,
        `Grupos: ${config.replyToGroups ? "✅" : "❌"}`,
        `Gatilho: ${config.trigger.toUpperCase()}`,
      ]
        .filter(Boolean)
        .join("\n")
    );
    return true;
  }
  if (cmd === "/ajuda" || cmd === "/help") {
    await reply(
      [
        `🤖 *${config.botName}* — comandos (só você vê/usa):`,
        "/pausar — pausa o bot (no chat consigo mesmo = pausa geral)",
        "/retomar — reativa o bot",
        "/status — mostra o estado atual",
        `${config.trigger.toUpperCase()} <instrução> — invoca o assistente em qualquer conversa`,
      ].join("\n")
    );
    return true;
  }
  return false;
}
