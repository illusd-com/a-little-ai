import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const username = req.nextUrl.searchParams.get("username");
    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }
    const messages = await getMessages(username);
    return NextResponse.json({ messages });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
