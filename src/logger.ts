import pino from "pino";
import { config } from "./config";

export const logger = pino({ level: config.logLevel });

// Logger separado e silencioso para o Baileys (ele é MUITO verboso em info)
export const baileysLogger = pino({ level: "warn" });
