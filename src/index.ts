import { config, validateConfig } from "./config";
import { logger } from "./logger";
import { startWhatsApp } from "./whatsapp/connection";
import { registerMessageHandler } from "./whatsapp/messageHandler";
import { registerCallHandler } from "./whatsapp/callHandler";

async function main(): Promise<void> {
  validateConfig();
  logger.info(`🤖 Iniciando ${config.botName}...`);
  await startWhatsApp((sock) => {
    registerMessageHandler(sock);
    registerCallHandler(sock);
  });
}

main().catch((err) => {
  logger.error({ err }, "Erro fatal ao iniciar");
  process.exit(1);
});
