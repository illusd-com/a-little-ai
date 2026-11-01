import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.warn("TURSO_DATABASE_URL is not set. Database features will fail.");
}

export const turso = createClient({
  url: url || "file:local.db",
  authToken: authToken,
});

export async function initDb() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password_hash TEXT,
      reasoning_effort TEXT DEFAULT 'medium',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      reasoning TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (username) REFERENCES users(username)
    )
  `);
  await turso.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_username ON messages(username)
  `);
}
