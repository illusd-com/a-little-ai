import { NextRequest, NextResponse } from "next/server";
import { ensureUser, setPassword, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, username, password } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    if (action === "check") {
      const user = await ensureUser(username);
      return NextResponse.json({
        username: user.username,
        hasPassword: user.hasPassword,
        reasoning_effort: user.reasoning_effort,
      });
    }

    if (action === "login") {
      const user = await ensureUser(username);
      if (user.hasPassword) {
        if (!password) {
          return NextResponse.json({ error: "Password required", needsPassword: true }, { status: 401 });
        }
        const ok = await verifyPassword(username, password);
        if (!ok) {
          return NextResponse.json({ error: "Wrong password" }, { status: 401 });
        }
      }
      return NextResponse.json({
        ok: true,
        username: user.username,
        hasPassword: user.hasPassword,
        reasoning_effort: user.reasoning_effort,
      });
    }

    if (action === "setPassword") {
      if (!password || password.length < 4) {
        return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
      }
      await ensureUser(username);
      await setPassword(username, password);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
