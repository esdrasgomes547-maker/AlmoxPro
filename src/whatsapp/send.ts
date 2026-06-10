import type { AnyMessageContent, MiscMessageGenerationOptions, WASocket } from "@whiskeysockets/baileys";

// IDs das mensagens que o próprio bot enviou — evita que ele responda a si
// mesmo (essencial no chat "mensagens para mim mesmo", onde tudo é fromMe)
const sentByBot = new Set<string>();

export function wasSentByBot(id: string | null | undefined): boolean {
  return !!id && sentByBot.has(id);
}

export async function sendTracked(
  sock: WASocket,
  jid: string,
  content: AnyMessageContent,
  options?: MiscMessageGenerationOptions
) {
  const res = await sock.sendMessage(jid, content, options);
  const id = res?.key?.id;
  if (id) {
    sentByBot.add(id);
    if (sentByBot.size > 2000) {
      const oldest = sentByBot.values().next().value;
      if (oldest) sentByBot.delete(oldest);
    }
  }
  return res;
}
