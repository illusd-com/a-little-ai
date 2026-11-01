import bcrypt from "bcryptjs";
import { turso, initDb } from "./db";

export async function ensureUser(username: string) {
  await initDb();
  const clean = username.trim().toLowerCase().slice(0, 64);
  if (!clean || clean.length < 1) throw new Error("Invalid username");
  const existing = await turso.execute({
    sql: "SELECT username, password_hash, reasoning_effort FROM users WHERE username = ?",
    args: [clean],
  });
  if (existing.rows.length === 0) {
    await turso.execute({
      sql: "INSERT INTO users (username) VALUES (?)",
      args: [clean],
    });
    return { username: clean, hasPassword: false, reasoning_effort: "medium" };
  }
  const row = existing.rows[0];
  return {
    username: row.username as string,
    hasPassword: !!row.password_hash,
    reasoning_effort: (row.reasoning_effort as string) || "medium",
  };
}

export async function setPassword(username: string, password: string) {
  await initDb();
  const clean = username.trim().toLowerCase();
  const hash = await bcrypt.hash(password, 10);
  await turso.execute({
    sql: "UPDATE users SET password_hash = ? WHERE username = ?",
    args: [hash, clean],
  });
}

export async function verifyPassword(username: string, password: string) {
  await initDb();
  const clean = username.trim().toLowerCase();
  const res = await turso.execute({
    sql: "SELECT password_hash FROM users WHERE username = ?",
    args: [clean],
  });
  if (res.rows.length === 0 || !res.rows[0].password_hash) return false;
  return bcrypt.compare(password, res.rows[0].password_hash as string);
}

export async function setReasoningEffort(username: string, effort: string) {
  await initDb();
  const clean = username.trim().toLowerCase();
  const allowed = ["low", "medium", "high"];
  if (!allowed.includes(effort)) throw new Error("Invalid effort");
  await turso.execute({
    sql: "UPDATE users SET reasoning_effort = ? WHERE username = ?",
    args: [effort, clean],
  });
}

export async function getMessages(username: string, limit = 100) {
  await initDb();
  const clean = username.trim().toLowerCase();
  const res = await turso.execute({
    sql: "SELECT id, role, content, reasoning, created_at FROM messages WHERE username = ? ORDER BY id ASC LIMIT ?",
    args: [clean, limit],
  });
  return res.rows.map((r) => ({
    id: r.id as number,
    role: r.role as string,
    content: r.content as string,
    reasoning: r.reasoning as string | null,
    created_at: r.created_at as string,
  }));
}

export async function addMessage(
  username: string,
  role: string,
  content: string,
  reasoning?: string | null
) {
  await initDb();
  const clean = username.trim().toLowerCase();
  await turso.execute({
    sql: "INSERT INTO messages (username, role, content, reasoning) VALUES (?, ?, ?, ?)",
    args: [clean, role, content, reasoning || null],
  });
}
