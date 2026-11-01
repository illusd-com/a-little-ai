import { NextRequest, NextResponse } from "next/server";
import { setReasoningEffort, ensureUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, reasoning_effort } = body;
    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }
    await ensureUser(username);
    if (reasoning_effort) {
      await setReasoningEffort(username, reasoning_effort);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
