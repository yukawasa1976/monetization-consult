"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesRef = useRef<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep ref in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const newMessages = [...messagesRef.current, userMessage];
    setMessages(newMessages);
    messagesRef.current = newMessages;
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      const withAssistant = [...newMessages, { role: "assistant" as const, content: "" }];
      setMessages(withAssistant);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        // Keep the last (possibly incomplete) part in the buffer
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              assistantContent += parsed.text;
              const updated = [
                ...newMessages,
                { role: "assistant" as const, content: assistantContent },
              ];
              setMessages(updated);
              messagesRef.current = updated;
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "エラーが発生しました";
      const errorMessages = [
        ...newMessages,
        {
          role: "assistant" as const,
          content: `申し訳ありません、エラーが発生しました: ${errorMessage}`,
        },
      ];
      setMessages(errorMessages);
      messagesRef.current = errorMessages;
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-lg font-bold text-zinc-900">
            川崎裕一のマネタイズ相談
          </h1>
          <p className="text-sm text-zinc-500">
            インターネットサービスの収益化について相談できます
          </p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 text-4xl">💬</div>
              <h2 className="mb-2 text-xl font-semibold text-zinc-800">
                マネタイズの相談をしてみましょう
              </h2>
              <p className="mb-8 max-w-md text-sm text-zinc-500">
                サービスの収益化、価格設計、ビジネスモデルなど、
                マネタイズに関することなら何でもご相談ください。
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "SaaSの価格設計について相談したい",
                  "広告モデルとサブスクどちらが良い？",
                  "フリーミアムの設計ポイントは？",
                  "AI時代のマネタイズ戦略を教えて",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-800 shadow-sm border border-zinc-100"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="mb-1 text-xs font-semibold text-zinc-500">
                    川崎裕一
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                  {isLoading &&
                    message.role === "assistant" &&
                    index === messages.length - 1 &&
                    message.content === "" && (
                      <span className="inline-block animate-pulse">
                        考えています...
                      </span>
                    )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-3xl gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="マネタイズについて相談する..."
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition-colors hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-900"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-zinc-400">
          AIによる回答です。重要な判断は専門家にもご相談ください。
        </p>
      </div>
    </div>
  );
}
