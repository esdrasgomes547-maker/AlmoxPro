import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import path from "path";
import { config } from "../config";
import { logger, baileysLogger } from "../logger";

export type RegisterHandlers = (sock: WASocket) => void;

export async function startWhatsApp(register: RegisterHandlers): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(config.dataDir, "auth")
  );
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: baileysLogger,
    browser: ["LevTheBot", "Chrome", "1.0.0"],
    // false = seu celular continua recebendo notificações normalmente
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info("Escaneie o QR code abaixo com o WhatsApp (Aparelhos conectados):");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      logger.info(`✅ ${config.botName} conectado ao WhatsApp como ${sock.user?.id}`);
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        logger.error(
          "Sessão deslogada (você removeu o aparelho no WhatsApp). Apague a pasta data/auth e escaneie o QR de novo."
        );
        process.exit(1);
      }
      logger.warn({ statusCode }, "Conexão caiu, reconectando em 3s...");
      setTimeout(() => {
        startWhatsApp(register).catch((err) =>
          logger.error({ err }, "Falha ao reconectar")
        );
      }, 3000);
    }
  });

  register(sock);
}
