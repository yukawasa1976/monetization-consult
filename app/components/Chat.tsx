"use client";

import { useState, useRef, useEffect } from "react";
import FileUpload from "./FileUpload";
import EvaluationResult from "./EvaluationResult";
import CopyButton from "./CopyButton";

type Message = {
  role: "user" | "assistant";
  content: string;
  type?: "chat" | "evaluation";
};

type Mode = "chat" | "evaluate";

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const readStream = async (
    response: Response,
    newMessages: Message[],
    messageType: "chat" | "evaluation"
  ) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const decoder = new TextDecoder();
    let assistantContent = "";
    let buffer = "";

    const withAssistant = [
      ...newMessages,
      { role: "assistant" as const, content: "", type: messageType },
    ];
    setMessages(withAssistant);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "evaluation_start") continue;
          if (parsed.text) {
            assistantContent += parsed.text;
            const updated = [
              ...newMessages,
              {
                role: "assistant" as const,
                content: assistantContent,
                type: messageType,
              },
            ];
            setMessages(updated);
            messagesRef.current = updated;
          }
        } catch {
          // skip malformed JSON
        }
      }
    }
  };

  const sendChat = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: "user", content: trimmed, type: "chat" };
    const newMessages = [...messagesRef.current, userMessage];
    setMessages(newMessages);
    messagesRef.current = newMessages;
    setInput("");
    setIsLoading(true);

    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      await readStream(response, newMessages, "chat");
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

  const sendEvaluation = async () => {
    if (isLoading) return;
    if (!input.trim() && !attachedFile) return;

    const displayContent = attachedFile
      ? `📎 ${attachedFile.name} をアップロードしました`
      : input.trim();

    const userMessage: Message = {
      role: "user",
      content: displayContent,
      type: "evaluation",
    };
    const newMessages = [...messagesRef.current, userMessage];
    setMessages(newMessages);
    messagesRef.current = newMessages;
    setInput("");
    setIsLoading(true);

    try {
      let response: Response;

      if (attachedFile) {
        const formData = new FormData();
        formData.append("file", attachedFile);
        response = await fetch("/api/evaluate", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: input.trim() || displayContent }),
        });
      }

      setAttachedFile(null);

      if (!response.ok) {
        let detail = "";
        try {
          const errBody = await response.json();
          detail = errBody.error || "";
        } catch { /* ignore */ }
        throw new Error(detail || `API error: ${response.status}`);
      }
      await readStream(response, newMessages, "evaluation");
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

  const handleSend = () => {
    if (mode === "evaluate") {
      sendEvaluation();
    } else {
      sendChat();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const switchToChat = (suggestion?: string) => {
    setMode("chat");
    setAttachedFile(null);
    if (suggestion) {
      setInput(suggestion);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const getFollowUpSuggestions = (content: string): string[] => {
    const axes = [
      { label: "売り物", pattern: /【売り物:\s*(\d+)\/20】/ },
      { label: "値付け", pattern: /【値付け:\s*(\d+)\/20】/ },
      { label: "売る人", pattern: /【売る人:\s*(\d+)\/20】/ },
      { label: "売れる仕組み", pattern: /【売れる仕組み:\s*(\d+)\/20】/ },
      { label: "売上管理", pattern: /【売上管理:\s*(\d+)\/20】/ },
    ];
    const scored = axes
      .map(({ label, pattern }) => {
        const m = content.match(pattern);
        return m ? { label, score: parseInt(m[1], 10) } : null;
      })
      .filter((x): x is { label: string; score: number } => x !== null)
      .sort((a, b) => a.score - b.score);

    const suggestions: string[] = [];
    if (scored.length >= 2) {
      suggestions.push(`「${scored[0].label}」の改善方法を具体的に教えて`);
      suggestions.push(`「${scored[1].label}」を強化するにはどうすればいい？`);
    }
    suggestions.push("全体的な改善の優先順位を教えて");
    return suggestions;
  };

  const switchToEvaluate = () => {
    setMode("evaluate");
  };

  return (
    <div className="flex h-dvh flex-col bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-zinc-900">
              川崎裕一のマネタイズ相談
            </h1>
            <p className="text-sm text-zinc-500">
              {mode === "chat"
                ? "インターネットサービスの収益化について相談できます"
                : "事業計画評価モード"}
            </p>
          </div>
          <div className="flex gap-2">
            {mode === "chat" ? (
              <button
                onClick={switchToEvaluate}
                disabled={isLoading}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                事業計画を評価する
              </button>
            ) : (
              <button
                onClick={() => switchToChat()}
                disabled={isLoading}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                チャットに戻る
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && mode === "chat" && (
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

          {messages.length === 0 && mode === "evaluate" && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 text-4xl">📊</div>
              <h2 className="mb-2 text-xl font-semibold text-zinc-800">
                事業計画を評価します
              </h2>
              <p className="mb-4 max-w-md text-sm text-zinc-500">
                事業計画のテキストを貼り付けるか、ファイルをアップロードしてください。
                5つの軸で100点満点のスコアをつけて、改善アドバイスを提供します。
              </p>
              <div className="grid grid-cols-5 gap-2 text-center text-xs text-zinc-500">
                {["売り物", "値付け", "売る人", "売れる仕組み", "売上管理"].map(
                  (axis) => (
                    <div
                      key={axis}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-2"
                    >
                      {axis}
                      <div className="mt-1 text-zinc-400">/20点</div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "max-w-[85%] bg-zinc-900 text-white"
                    : message.type === "evaluation"
                      ? "w-full bg-white text-zinc-800 shadow-sm border border-zinc-100"
                      : "max-w-[85%] bg-white text-zinc-800 shadow-sm border border-zinc-100"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="mb-1 text-xs font-semibold text-zinc-500">
                    川崎裕一
                    {message.type === "evaluation" && (
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-400">
                        事業計画評価
                      </span>
                    )}
                  </div>
                )}
                {message.role === "assistant" &&
                message.type === "evaluation" ? (
                  <EvaluationResult
                    content={message.content}
                    isStreaming={isLoading && index === messages.length - 1}
                  />
                ) : (
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
                )}
                {message.role === "assistant" &&
                  message.content &&
                  !(isLoading && index === messages.length - 1) && (
                    <div className="mt-2 flex justify-end">
                      <CopyButton text={message.content} />
                    </div>
                  )}
              </div>
            </div>
          ))}

          {/* Post-evaluation follow-up */}
          {!isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1]?.type === "evaluation" &&
            messages[messages.length - 1]?.role === "assistant" &&
            messages[messages.length - 1]?.content !== "" && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl border border-zinc-100 bg-white px-4 py-3 shadow-sm">
                  <div className="mb-1 text-xs font-semibold text-zinc-500">
                    川崎裕一
                  </div>
                  <div className="mb-3 text-sm leading-relaxed text-zinc-800">
                    評価結果について、もう少し詳しくお話しできます。気になる点はありますか？
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getFollowUpSuggestions(
                      messages[messages.length - 1].content
                    ).map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => switchToChat(suggestion)}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 bg-white px-4 py-4">
        {attachedFile && (
          <div className="mx-auto mb-2 max-w-3xl">
            <FileUpload
              onFileSelect={setAttachedFile}
              selectedFile={attachedFile}
              onClear={() => setAttachedFile(null)}
              disabled={isLoading}
            />
          </div>
        )}
        <div className="mx-auto flex max-w-3xl gap-3">
          {mode === "evaluate" && !attachedFile && (
            <FileUpload
              onFileSelect={setAttachedFile}
              selectedFile={null}
              onClear={() => setAttachedFile(null)}
              disabled={isLoading}
            />
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "evaluate"
                ? "事業計画のテキストを貼り付ける..."
                : "マネタイズについて相談する..."
            }
            rows={mode === "evaluate" ? 4 : 1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !attachedFile) || isLoading}
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
