import type { WASocket } from "@whiskeysockets/baileys";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tempo de "digitando…" proporcional ao tamanho da resposta, com
 * aleatoriedade leve para parecer humano. Entre ~1s e ~7s.
 */
export function replyDelayMs(text: string): number {
  const base = 900 + text.length * 35;
  const jitter = base * (0.75 + Math.random() * 0.5);
  return Math.min(Math.max(jitter, 1000), 7000);
}

/**
 * Mostra "digitando…" ou "gravando áudio…" pelo tempo indicado.
 */
export async function showPresence(
  sock: WASocket,
  jid: string,
  kind: "composing" | "recording",
  ms: number
): Promise<void> {
  try {
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate(kind, jid);
    await sleep(ms);
    await sock.sendPresenceUpdate("paused", jid);
  } catch {
    // presença é cosmética; nunca deve derrubar o fluxo
  }
}
