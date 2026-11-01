"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Msg = {
  id?: number;
  role: string;
  content: string;
  reasoning?: string | null;
};

export default function Home() {
  const [phase, setPhase] = useState<"enter" | "password" | "chat">("enter");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inputUser, setInputUser] = useState("");
  const [inputPass, setInputPass] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("medium");
  const [showSettings, setShowSettings] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [streaming, setStreaming] = useState("");
  const [streamingReasoning, setStreamingReasoning] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming, scrollToBottom]);

  // Restore session
  useEffect(() => {
    const saved = localStorage.getItem("alittleai_user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUsername(u.username);
        setReasoningEffort(u.reasoning_effort || "medium");
        fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check", username: u.username }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.hasPassword) {
              setPhase("password");
              setInputUser(u.username);
            } else {
              setPhase("chat");
              loadMessages(u.username);
            }
          })
          .catch(() => {});
      } catch {}
    }
  }, []);

  async function loadMessages(user: string) {
    try {
      const res = await fetch(`/api/messages?username=${encodeURIComponent(user)}`);
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch {}
  }

  async function handleEnter() {
    setError("");
    const name = inputUser.trim();
    if (!name) {
      setError("請輸入用戶名 / Please enter a username");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", username: name }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      setUsername(data.username);
      setReasoningEffort(data.reasoning_effort || "medium");
      if (data.hasPassword) {
        setPhase("password");
      } else {
        localStorage.setItem(
          "alittleai_user",
          JSON.stringify({ username: data.username, reasoning_effort: data.reasoning_effort })
        );
        setPhase("chat");
        await loadMessages(data.username);
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    }
    setLoading(false);
  }

  async function handlePassword() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username: inputUser, password: inputPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Wrong password");
        setLoading(false);
        return;
      }
      setUsername(data.username);
      setReasoningEffort(data.reasoning_effort || "medium");
      localStorage.setItem(
        "alittleai_user",
        JSON.stringify({ username: data.username, reasoning_effort: data.reasoning_effort })
      );
      setPhase("chat");
      await loadMessages(data.username);
    } catch (e: any) {
      setError(e.message || "Network error");
    }
    setLoading(false);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);
    setStreaming("");
    setStreamingReasoning("");
    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, message: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to chat");
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setLoading(false);
        return;
      }
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let reasoning = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (!data) continue;
            try {
              const json = JSON.parse(data);
              if (json.content) {
                content += json.content;
                setStreaming(content);
              }
              if (json.reasoning) {
                reasoning += json.reasoning;
                setStreamingReasoning(reasoning);
              }
              if (json.done) {
                setMessages((m) => [
                  ...m,
                  { role: "assistant", content, reasoning: reasoning || null },
                ]);
                setStreaming("");
                setStreamingReasoning("");
              }
              if (json.error) {
                setError(json.error);
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      setError(e.message || "Stream error");
    }
    setLoading(false);
  }

  async function savePassword() {
    if (newPass.length < 4) {
      setError("Password ≥ 4 chars");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setPassword", username, password: newPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setNewPass("");
        setShowSettings(false);
        setError("");
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function saveEffort(effort: string) {
    setReasoningEffort(effort);
    localStorage.setItem(
      "alittleai_user",
      JSON.stringify({ username, reasoning_effort: effort })
    );
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, reasoning_effort: effort }),
      });
    } catch {}
  }

  function logout() {
    localStorage.removeItem("alittleai_user");
    setPhase("enter");
    setUsername("");
    setMessages([]);
    setInputUser("");
    setInputPass("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (phase === "enter") handleEnter();
      else if (phase === "password") handlePassword();
      else sendMessage();
    }
  }

  // ——— UI ———
  if (phase === "enter" || phase === "password") {
    return (
      <>
        <header className="top">
          <div className="top-inner">
            <div className="brand">a little ai</div>
            <span className="kicker">free · no signup</span>
          </div>
        </header>

        <main className="wrap">
          <section className="hero rise">
            <p className="kicker">NVIDIA · Step 5 Preview</p>
            <h1>a little ai</h1>
            <p className="sub">Just a username. Memory travels with you.</p>
          </section>

          <section className="sec rise" style={{ maxWidth: 380, margin: "0 auto" }}>
            <p className="kicker" style={{ marginBottom: 12 }}>
              {phase === "enter" ? "Start / 開始" : "Password / 密碼"}
            </p>

            {phase === "enter" ? (
              <>
                <div className="field">
                  <label>Username · 用戶名</label>
                  <input
                    className="input"
                    value={inputUser}
                    onChange={(e) => setInputUser(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="any name you like"
                    autoFocus
                    maxLength={64}
                  />
                </div>
                <button className="cta" onClick={handleEnter} disabled={loading} style={{ width: "100%" }}>
                  {loading ? "…" : "Enter · 進入"}
                </button>
              </>
            ) : (
              <>
                <p style={{ marginBottom: 12, color: "var(--soft)", fontSize: 14 }}>
                  Agent <strong>{inputUser}</strong> is protected.
                </p>
                <div className="field">
                  <label>Password · 密碼</label>
                  <input
                    className="input"
                    type="password"
                    value={inputPass}
                    onChange={(e) => setInputPass(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="••••"
                    autoFocus
                  />
                </div>
                <button className="cta" onClick={handlePassword} disabled={loading} style={{ width: "100%" }}>
                  {loading ? "…" : "Unlock · 解鎖"}
                </button>
                <button
                  className="btn-sm"
                  style={{ marginTop: 12, width: "100%" }}
                  onClick={() => {
                    setPhase("enter");
                    setInputPass("");
                    setError("");
                  }}
                >
                  Back · 返回
                </button>
              </>
            )}

            {error && (
              <p style={{ marginTop: 16, color: "var(--i)", fontSize: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                {error}
              </p>
            )}
          </section>

          <section className="sec" style={{ textAlign: "center", color: "var(--soft)", fontSize: 13 }}>
            <p>Chat history is stored in Turso · 聊天記錄保存在 Turso</p>
            <p style={{ marginTop: 6 }}>Set a password later to become an Agent · 之後可設密碼成為 Agent</p>
          </section>
        </main>
      </>
    );
  }

  // Chat phase
  return (
    <>
      <header className="top">
        <div className="top-inner">
          <div className="brand">a little ai</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="kicker" style={{ fontSize: 11 }}>
              {username} · {reasoningEffort}
            </span>
            <button className="btn-sm" onClick={() => setShowSettings(true)}>
              Settings
            </button>
            <button className="btn-sm" onClick={logout}>
              Exit
            </button>
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className="chat-messages">
          {messages.length === 0 && !streaming && (
            <div className="empty rise">
              Say something. Memory will follow you across devices.
              <br />
              <span style={{ fontSize: 13 }}>輸入任何內容開始 · 記憶會跟著你走</span>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="msg-bubble">
                {m.content}
                {m.reasoning && (
                  <div className="reasoning">
                    <span className="kicker" style={{ display: "block", marginBottom: 4 }}>
                      reasoning
                    </span>
                    {m.reasoning}
                  </div>
                )}
              </div>
            </div>
          ))}
          {(streaming || streamingReasoning) && (
            <div className="msg assistant">
              <div className="msg-bubble">
                {streaming || <span className="loading-dot" />}
                {streamingReasoning && (
                  <div className="reasoning">
                    <span className="kicker" style={{ display: "block", marginBottom: 4 }}>
                      reasoning
                    </span>
                    {streamingReasoning}
                  </div>
                )}
              </div>
            </div>
          )}
          {loading && !streaming && !streamingReasoning && (
            <div className="msg assistant">
              <div className="msg-bubble">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <div className="composer">
        <div className="composer-inner">
          <textarea
            ref={textareaRef}
            className="textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message · 訊息…"
            rows={1}
            disabled={loading}
          />
          <button className="cta" onClick={sendMessage} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
        {error && (
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--i)", marginTop: 8 }}>{error}</p>
        )}
      </div>

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Settings · 設定</h2>
            <p>Become an Agent by setting a password. Adjust reasoning effort.</p>

            <div className="field">
              <label>Reasoning Effort · 推理程度</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["low", "medium", "high"].map((e) => (
                  <button
                    key={e}
                    className={reasoningEffort === e ? "cta" : "btn-sm"}
                    style={{ flex: 1, padding: "10px 0" }}
                    onClick={() => saveEffort(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Set Password · 設定密碼 (Agent)</label>
              <input
                className="input"
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="min 4 characters"
              />
            </div>
            <button className="cta" style={{ width: "100%" }} onClick={savePassword} disabled={loading}>
              Save Password
            </button>
            <button
              className="btn-sm"
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => setShowSettings(false)}
            >
              Close
            </button>
            {error && <p style={{ marginTop: 12, fontSize: 13 }}>{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
