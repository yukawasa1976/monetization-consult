"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import FileUpload from "./FileUpload";
import EvaluationResult from "./EvaluationResult";
import CopyButton from "./CopyButton";
import AuthButton from "./AuthButton";
import ConsultationForm from "./ConsultationForm";

const FREE_MESSAGE_LIMIT = 3;
const CONSULTATION_CTA_AFTER = 3; // 3往復後に直接相談の導線を表示
const STORAGE_KEY = "monetize_pending_messages";

type Message = {
  role: "user" | "assistant";
  content: string;
  type?: "chat" | "evaluation";
};

type Mode = "chat" | "evaluate";

export default function Chat() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationCopied, setConversationCopied] = useState(false);
  const [showFeedbackInline, setShowFeedbackInline] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<"bug" | "improvement" | "other">("improvement");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [truncationWarning, setTruncationWarning] = useState(false);
  const [lastUserInput, setLastUserInput] = useState<{ text: string; file: File | null } | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const searchParams = useSearchParams();
  const [showConsultationForm, setShowConsultationForm] = useState(false);

  // ログイン後に ?consultation=true があればフォームを自動表示
  useEffect(() => {
    if (searchParams.get("consultation") === "true" && session?.user) {
      setShowConsultationForm(true);
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams, session]);

  // ?session=xxx で過去の会話を復元
  useEffect(() => {
    const resumeSessionId = searchParams.get("session");
    if (!resumeSessionId || !session?.user) return;

    fetch(`/api/sessions/${resumeSessionId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          const loaded = data.messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            type: "chat" as const,
          }));
          setMessages(loaded);
          messagesRef.current = loaded;
          setSessionId(resumeSessionId);
          setMode("chat");
        }
      })
      .catch((err) => console.error("Failed to load session:", err));

    window.history.replaceState({}, "", "/");
  }, [searchParams, session]);

  // 未ログイン時: メッセージをlocalStorageに保存
  useEffect(() => {
    if (session?.user) return; // ログイン済みなら保存しない
    if (messages.length === 0) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ messages, mode })
      );
    } catch {
      // localStorage full or unavailable
    }
  }, [messages, mode, session]);

  // ログイン後に ?restore=true があればlocalStorageから復元
  useEffect(() => {
    if (searchParams.get("restore") !== "true" || !session?.user) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { messages: savedMessages, mode: savedMode } = JSON.parse(saved);
        if (savedMessages && savedMessages.length > 0) {
          setMessages(savedMessages);
          messagesRef.current = savedMessages;
          if (savedMode) setMode(savedMode);
        }
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore parse errors
    }
    window.history.replaceState({}, "", "/");
  }, [searchParams, session]);

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const isLimitReached = !session?.user && userMessageCount >= FREE_MESSAGE_LIMIT;

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
          if (parsed.type === "truncation_warning") {
            setTruncationWarning(true);
            continue;
          }
          if (parsed.sessionId) {
            setSessionId(parsed.sessionId);
            continue;
          }
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

  const sendChat = async (directText?: string) => {
    const trimmed = (directText ?? input).trim();
    if (!trimmed || isLoading) return;

    setLastUserInput({ text: trimmed, file: null });
    setTruncationWarning(false);
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
        body: JSON.stringify({ messages: apiMessages, sessionId }),
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

  const sendEvaluation = async (retryFile?: File | null) => {
    if (isLoading) return;
    const fileToUse = retryFile !== undefined ? retryFile : attachedFile;
    if (!input.trim() && !fileToUse) return;

    setLastUserInput({ text: input.trim(), file: fileToUse });
    setTruncationWarning(false);
    const displayContent = fileToUse
      ? `📎 ${fileToUse.name} をアップロードしました`
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

      if (fileToUse) {
        const formData = new FormData();
        formData.append("file", fileToUse);
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
      setInput("");
      sendChat(suggestion);
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

  const handleRetry = () => {
    if (!lastUserInput) return;
    // 最後のユーザーメッセージとエラー応答を除去
    const trimmed = messagesRef.current.slice(0, -2);
    setMessages(trimmed);
    messagesRef.current = trimmed;
    if (mode === "evaluate") {
      setInput(lastUserInput.text);
      setAttachedFile(lastUserInput.file ?? null);
      setTimeout(() => sendEvaluation(lastUserInput.file), 0);
    } else {
      sendChat(lastUserInput.text);
    }
  };

  const switchToEvaluate = () => {
    setMode("evaluate");
  };

  const copyConversation = async () => {
    const text = messages
      .map((m) => {
        const prefix = m.role === "user" ? "あなた" : "川崎裕一";
        const content =
          m.role === "assistant"
            ? parseSuggestions(m.content).body
            : m.content;
        return `${prefix}:\n${content}`;
      })
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(text);
    setConversationCopied(true);
    setTimeout(() => setConversationCopied(false), 2000);
  };

  const submitFeedback = async () => {
    if (!feedbackContent.trim()) return;
    setFeedbackSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: feedbackCategory, content: feedbackContent.trim(), sessionId }),
      });
      if (!res.ok) throw new Error();
      setFeedbackSent(true);
    } catch {
      alert("送信に失敗しました。もう一度お試しください。");
    } finally {
      setFeedbackSending(false);
    }
  };

  const resetFeedback = () => {
    setShowFeedbackInline(false);
    setFeedbackContent("");
    setFeedbackCategory("improvement");
    setFeedbackSent(false);
  };

  const parseSuggestions = (content: string): { body: string; suggestions: string[] } => {
    const match = content.match(/\n*【次の質問候補】\n([\s\S]*?)$/);
    if (!match) return { body: content, suggestions: [] };
    const body = content.slice(0, match.index).trimEnd();
    const suggestions = match[1]
      .split("\n")
      .map((line) => line.replace(/^[-・]\s*/, "").trim())
      .filter((line) => line.length > 0);
    return { body, suggestions };
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
                : mode === "evaluate"
                  ? "事業計画評価モード"
                  : "インターネットサービスの収益化について相談できます"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFeedbackInline(true)}
              className="text-xs text-zinc-400 transition-colors hover:text-zinc-600"
            >
              ご意見・ご要望
            </button>
            <AuthButton />
            {mode === "chat" && (
              <button
                onClick={switchToEvaluate}
                disabled={isLoading}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                事業計画を評価する
              </button>
            )}
            {mode === "evaluate" && (
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
          {messages.length === 0 && mode === null && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h2 className="mb-2 text-xl font-semibold text-zinc-800">
                川崎裕一のマネタイズ相談
              </h2>
              <p className="mb-10 max-w-md text-sm text-zinc-500">
                サービスの収益化、価格設計、ビジネスモデルなど、
                マネタイズに関することなら何でもご相談ください。
              </p>
              <div className="grid w-full max-w-lg gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setMode("chat")}
                  className="group rounded-2xl border border-zinc-200 bg-white p-6 text-left transition-all hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="mb-3 text-3xl">💬</div>
                  <h3 className="mb-2 text-base font-semibold text-zinc-900">
                    相談する
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-500">
                    マネタイズの悩みをチャットで相談。価格設計、ビジネスモデル、収益化戦略など。
                  </p>
                </button>
                <button
                  onClick={() => setMode("evaluate")}
                  className="group rounded-2xl border border-zinc-200 bg-white p-6 text-left transition-all hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="mb-3 text-3xl">📊</div>
                  <h3 className="mb-2 text-base font-semibold text-zinc-900">
                    事業計画を評価する
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-500">
                    5つの軸で100点満点のスコア評価。具体的な改善アドバイスを提供します。
                  </p>
                </button>
              </div>
            </div>
          )}

          {messages.length === 0 && mode === "chat" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="mb-6 text-sm text-zinc-500">
                質問を入力するか、テーマを選んでください
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
                    onClick={() => sendChat(suggestion)}
                    className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length === 0 && mode === "evaluate" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="mb-4 max-w-md text-sm text-zinc-500">
                事業計画のテキストを貼り付けるか、ファイルをアップロードしてください。
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

          {truncationWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              ファイルが30,000文字を超えたため、一部を省略して評価しています
            </div>
          )}

          {messages.map((message, index) => {
            // このメッセージまでのアシスタント回答数をカウント
            const assistantCountUpToHere = messages
              .slice(0, index + 1)
              .filter((m) => m.role === "assistant").length;
            const showCtaAfterThis =
              message.role === "assistant" &&
              !isLoading &&
              message.content &&
              (message.type === "evaluation" ||
                (assistantCountUpToHere === CONSULTATION_CTA_AFTER && !!session?.user));

            return (
              <div key={index}>
                <div
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
                        {message.role === "assistant"
                          ? parseSuggestions(message.content).body
                          : message.content}
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
                        <div className="mt-2 flex items-center justify-end gap-2">
                          {message.content.startsWith("申し訳ありません、エラーが発生しました") && lastUserInput && (
                            <button
                              onClick={handleRetry}
                              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
                            >
                              もう一度試す
                            </button>
                          )}
                          <CopyButton text={parseSuggestions(message.content).body} />
                        </div>
                      )}
                  </div>
                </div>
                {showCtaAfterThis && (
                  <div className="my-4 rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-50 to-white p-5 text-center">
                    <p className="mb-3 text-sm text-zinc-600">
                      {message.type === "evaluation"
                        ? "この評価結果をもとに、より具体的な改善策を一緒に考えませんか？"
                        : "より深い相談は、直接お話しするとさらに具体的なアドバイスができます。"}
                    </p>
                    <button
                      onClick={() => setShowConsultationForm(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                    >
                      川崎裕一に直接相談する
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Suggestions (inside scroll area) */}
          {(() => {
            if (isLoading || messages.length === 0 || isLimitReached) return null;
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role !== "assistant" || !lastMsg.content) return null;

            if (lastMsg.type !== "evaluation") {
              const { suggestions } = parseSuggestions(lastMsg.content);
              if (suggestions.length === 0) return null;
              return (
                <div className="mt-4 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendChat(s)}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              );
            }

            const evalSuggestions = getFollowUpSuggestions(lastMsg.content);
            return (
              <div className="mt-4">
                <p className="mb-2 text-xs text-zinc-500">
                  評価結果について詳しく相談できます
                </p>
                <div className="flex flex-wrap gap-2">
                  {evalSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => switchToChat(s)}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Feedback CTA at conversation breakpoints */}
          {!isLoading && messages.length > 0 && !showFeedbackInline && !feedbackSent && (() => {
            const assistantCount = messages.filter((m) => m.role === "assistant").length;
            if (assistantCount < 2) return null;
            return (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowFeedbackInline(true)}
                  className="text-xs text-zinc-400 transition-colors hover:text-zinc-600"
                >
                  このサービスへのご意見・ご要望はありますか？
                </button>
              </div>
            );
          })()}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {mode !== null && (
      <div className="border-t border-zinc-200 bg-white px-4 py-4">
        {isLimitReached ? (
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm text-zinc-600">
              無料で相談できる回数（{FREE_MESSAGE_LIMIT}回）に達しました。
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => setShowConsultationForm(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
              >
                川崎裕一に直接相談する
              </button>
              <button
                onClick={() => signIn("google", { callbackUrl: "/?restore=true" })}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Googleでログインして続ける
              </button>
            </div>
            <button
              onClick={copyConversation}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-600"
            >
              {conversationCopied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-emerald-500">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  コピーしました
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
                    <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
                  </svg>
                  この会話をコピーしておく
                </>
              )}
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
      )}
      {showConsultationForm && (
        <ConsultationForm onClose={() => setShowConsultationForm(false)} />
      )}
      {showFeedbackInline && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 sm:items-center">
          <div className="mb-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:mb-0">
            {feedbackSent ? (
              <div className="text-center">
                <div className="mb-3 text-3xl">&#x2705;</div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  送信しました！
                </h3>
                <p className="mb-5 text-sm text-zinc-500">
                  フィードバックありがとうございます。改善に活かします。
                </p>
                <button
                  onClick={resetFeedback}
                  className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                >
                  閉じる
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-zinc-900">
                    ご意見・ご要望
                  </h3>
                  <button
                    onClick={resetFeedback}
                    className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                  </button>
                </div>
                <div className="mb-4 flex gap-2">
                  {([
                    { value: "bug" as const, label: "バグ" },
                    { value: "improvement" as const, label: "改善要望" },
                    { value: "other" as const, label: "その他" },
                  ]).map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setFeedbackCategory(cat.value)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        feedbackCategory === cat.value
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  placeholder="気になった点や要望を教えてください..."
                  rows={4}
                  className="mb-4 w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
                />
                <button
                  onClick={submitFeedback}
                  disabled={!feedbackContent.trim() || feedbackSending}
                  className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
                >
                  {feedbackSending ? "送信中..." : "送信する"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
