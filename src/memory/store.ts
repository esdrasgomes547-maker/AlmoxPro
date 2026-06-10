import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config";

fs.mkdirSync(config.dataDir, { recursive: true });
const db = new Database(path.join(config.dataDir, "levthebot.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat TEXT NOT NULL,
  role TEXT NOT NULL,
  sender TEXT,
  content TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat, id);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

export type StoredMessage = { role: "user" | "model"; sender: string | null; content: string };

const insertMsg = db.prepare(
  "INSERT INTO messages (chat, role, sender, content, ts) VALUES (?, ?, ?, ?, ?)"
);
const selectHistory = db.prepare(
  "SELECT role, sender, content FROM messages WHERE chat = ? ORDER BY id DESC LIMIT ?"
);
const kvGetStmt = db.prepare("SELECT value FROM kv WHERE key = ?");
const kvSetStmt = db.prepare(
  "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);
const kvDelStmt = db.prepare("DELETE FROM kv WHERE key = ?");

export function addMessage(
  chat: string,
  role: "user" | "model",
  content: string,
  sender?: string
): void {
  insertMsg.run(chat, role, sender ?? null, content, Date.now());
}

export function getHistory(chat: string, limit = config.historyLimit): StoredMessage[] {
  const rows = selectHistory.all(chat, limit) as StoredMessage[];
  return rows.reverse();
}

export function kvGet(key: string): string | undefined {
  const row = kvGetStmt.get(key) as { value: string } | undefined;
  return row?.value;
}

export function kvSet(key: string, value: string): void {
  kvSetStmt.run(key, value);
}

export function kvDelete(key: string): void {
  kvDelStmt.run(key);
}

export function isPaused(chat: string): boolean {
  return kvGet("paused:*") === "1" || kvGet(`paused:${chat}`) === "1";
}

export function setPaused(chat: string | "*", paused: boolean): void {
  if (paused) kvSet(`paused:${chat}`, "1");
  else kvDelete(`paused:${chat}`);
}
