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
const SHARE_BONUS_LIMIT = 3;
const REFERRAL_BONUS_LIMIT = 3;
const REFERRAL_BONUS_KEY = "monetize_referral_bonus";
const CONSULTATION_CTA_AFTER = 3; // 3往復後に直接相談の導線を表示
const STORAGE_KEY = "monetize_pending_messages";
const SHARE_BONUS_KEY = "monetize_share_bonus";

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
  const [showProfile, setShowProfile] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<"bug" | "improvement" | "other">("improvement");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [truncationWarning, setTruncationWarning] = useState(false);
  const [lastUserInput, setLastUserInput] = useState<{ text: string; file: File | null } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [hasSharedForBonus, setHasSharedForBonus] = useState(false);
  const [hasReferralBonus, setHasReferralBonus] = useState(false);
  const [recentSessions, setRecentSessions] = useState<
    { id: string; mode: string; created_at: string; message_count: number; first_message: string | null }[]
  >([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const messagesRef = useRef<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const searchParams = useSearchParams();
  const [showConsultationForm, setShowConsultationForm] = useState(false);
  const [showWallhittingForm, setShowWallhittingForm] = useState(false);

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

  // ログイン済み＆ランディング画面時に最近のセッションを取得
  useEffect(() => {
    if (!session?.user || mode !== null || messages.length > 0) return;
    setSessionsLoading(true);
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => {
        if (data.sessions) setRecentSessions(data.sessions);
      })
      .catch((err) => console.error("Failed to load sessions:", err))
      .finally(() => setSessionsLoading(false));
  }, [session, mode, messages.length]);

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

  // シェアボーナス・リファラルボーナスの復元
  useEffect(() => {
    try {
      if (localStorage.getItem(SHARE_BONUS_KEY) === "true") {
        setHasSharedForBonus(true);
      }
      if (localStorage.getItem(REFERRAL_BONUS_KEY) === "true") {
        setHasReferralBonus(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // ?ref= パラメータでリファラルボーナスを付与
  useEffect(() => {
    if (!searchParams.get("ref")) return;
    try {
      if (localStorage.getItem(REFERRAL_BONUS_KEY) !== "true") {
        localStorage.setItem(REFERRAL_BONUS_KEY, "true");
        setHasReferralBonus(true);
      }
    } catch {
      // ignore
    }
    window.history.replaceState({}, "", "/");
  }, [searchParams]);

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const bonusCount = (hasSharedForBonus ? SHARE_BONUS_LIMIT : 0) + (hasReferralBonus ? REFERRAL_BONUS_LIMIT : 0);
  const effectiveLimit = FREE_MESSAGE_LIMIT + bonusCount;
  const isLimitReached = !session?.user && userMessageCount >= effectiveLimit;

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

  const handleShare = async () => {
    if (isSharing) return;
    if (shareUrl) {
      setShowShareModal(true);
      return;
    }
    setIsSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShareUrl(data.url);
      setShowShareModal(true);
    } catch {
      alert("シェアリンクの作成に失敗しました");
    } finally {
      setIsSharing(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setShareLinkCopied(true);
    setTimeout(() => setShareLinkCopied(false), 2000);
  };

  const shareText = "川崎裕一のマネタイズ相談でこんなアドバイスをもらいました";

  const shareToX = () => {
    if (!shareUrl) return;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const shareToLine = () => {
    if (!shareUrl) return;
    window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const shareToFacebook = () => {
    if (!shareUrl) return;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const shareToEmail = () => {
    if (!shareUrl) return;
    window.open(`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const handleShareForBonus = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      let url = shareUrl;
      if (!url) {
        const res = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        url = data.url;
        setShareUrl(url);
      }
      setShowShareModal(true);
      setHasSharedForBonus(true);
      try { localStorage.setItem(SHARE_BONUS_KEY, "true"); } catch {}
    } catch {
      alert("シェアリンクの作成に失敗しました");
    } finally {
      setIsSharing(false);
    }
  };

  const parseSuggestions = (content: string): { body: string; suggestions: string[] } => {
    const match = content.match(/\n*【(?:次の質問候補|深掘りポイント)】\n([\s\S]*?)$/);
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
          <div className="flex items-center gap-3">
            <button onClick={() => setShowProfile(true)} className="shrink-0">
              <img src="/kawasaki-profile.jpg" alt="川崎裕一" className="h-9 w-9 rounded-full object-cover transition-opacity hover:opacity-80" />
            </button>
            <div>
            <h1 className="text-lg font-bold text-zinc-900">
              川崎裕一のマネタイズ相談
            </h1>
            {mode !== null && (
              <p className="text-sm text-zinc-500">
                {mode === "chat"
                  ? "インターネットサービスの収益化について相談できます"
                  : "事業計画評価モード"}
              </p>
            )}
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              {/* 最近の相談 */}
              {session?.user && sessionsLoading && (
                <div className="mt-10 w-full max-w-lg">
                  <p className="mb-3 text-xs font-medium text-zinc-400">最近の相談</p>
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="h-4 w-3/4 rounded bg-zinc-100" />
                        <div className="mt-2 h-3 w-1/3 rounded bg-zinc-100" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {session?.user && !sessionsLoading && recentSessions.length > 0 && (
                <div className="mt-10 w-full max-w-lg">
                  <p className="mb-3 text-xs font-medium text-zinc-400">最近の相談</p>
                  <div className="space-y-2">
                    {recentSessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          window.history.replaceState({}, "", `/?session=${s.id}`);
                          fetch(`/api/sessions/${s.id}/messages`)
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
                                setSessionId(s.id);
                                setMode("chat");
                              }
                            })
                            .catch((err) => console.error("Failed to load session:", err));
                          window.history.replaceState({}, "", "/");
                        }}
                        className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-left transition-all hover:border-zinc-300 hover:shadow-sm"
                      >
                        <p className="truncate text-sm text-zinc-800">
                          {s.first_message || (s.mode === "evaluate" ? "事業計画評価" : "新しい相談")}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-400">
                          <span>{s.mode === "evaluate" ? "評価" : "相談"}</span>
                          <span>{s.message_count}件のメッセージ</span>
                          <span>{new Date(s.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <a
                    href="/mypage"
                    className="mt-3 inline-block text-xs text-zinc-400 transition-colors hover:text-zinc-600"
                  >
                    すべての履歴を見る &rarr;
                  </a>
                </div>
              )}
              <div className="mt-10 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-zinc-400">
                <button onClick={() => setShowProfile(true)} className="transition-colors hover:text-zinc-600">川崎裕一について</button>
                <a href="/data-policy" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-zinc-600">データポリシー</a>
                <a href="/updates" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-zinc-600">更新履歴</a>
                <button onClick={() => setShowFeedbackInline(true)} className="transition-colors hover:text-zinc-600">ご意見・ご要望</button>
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
                          {sessionId && assistantCountUpToHere >= 2 && (
                            <button
                              onClick={handleShare}
                              disabled={isSharing}
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.474l6.733-3.367A2.52 2.52 0 0 1 13 4.5Z" />
                              </svg>
                              {isSharing ? "作成中..." : "シェア"}
                            </button>
                          )}
                          <CopyButton text={parseSuggestions(message.content).body} />
                        </div>
                      )}
                  </div>
                </div>
                {showCtaAfterThis && (
                  <div className="my-4 rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-50 to-white p-5 text-center">
                    <p className="mb-1 text-sm font-medium text-zinc-800">
                      AIで整理できた課題を、川崎本人と直接話しませんか？
                    </p>
                    <p className="mb-4 text-xs text-zinc-500">
                      壁打ち（30〜60分）でより具体的な打ち手を一緒に考えます
                    </p>
                    <button
                      onClick={() => setShowWallhittingForm(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                    >
                      川崎と壁打ちを申し込む
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
                <div className="mt-4">
                  <p className="mb-2 text-xs text-zinc-500">
                    もっと詳しく聞く
                  </p>
                  <div className="flex flex-wrap gap-2">
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
              無料で相談できる回数（{effectiveLimit}回）に達しました。
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
            {!hasSharedForBonus && sessionId && (
              <button
                onClick={handleShareForBonus}
                disabled={isSharing}
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.474l6.733-3.367A2.52 2.52 0 0 1 13 4.5Z" />
                </svg>
                {isSharing ? "準備中..." : `この会話をシェアするとあと${SHARE_BONUS_LIMIT}回相談できます`}
              </button>
            )}
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
              <br />
              会話内容・アップロードファイルは回答生成のみに使用し、第三者への共有やAI学習には使用しません。
              <a href="/data-policy" target="_blank" rel="noopener noreferrer" className="ml-1 underline hover:text-zinc-600">詳細</a>
              <span className="mx-1">・</span>
              <button onClick={() => setShowFeedbackInline(true)} className="underline hover:text-zinc-600">ご意見・ご要望</button>
            </p>
          </>
        )}
      </div>
      )}
      {showConsultationForm && (
        <ConsultationForm onClose={() => setShowConsultationForm(false)} />
      )}
      {showWallhittingForm && (
        <ConsultationForm onClose={() => setShowWallhittingForm(false)} variant="wallhitting" />
      )}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 sm:items-center">
          <div className="mb-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:mb-0">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900">川崎裕一について</h3>
              <button
                onClick={() => setShowProfile(false)}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <div className="flex items-start gap-4">
              <img src="/kawasaki-profile.jpg" alt="川崎裕一" className="h-16 w-16 shrink-0 rounded-full object-cover" />
              <div>
                <p className="text-sm font-semibold text-zinc-800">川崎裕一</p>
                <p className="text-xs text-zinc-500">エンジェル投資家 / マネタイズおじさん</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-zinc-600">
              はてな取締役副社長、ミクシィ取締役COO、スマートニュース執行役員を経て、現在はエンジェル投資家として活動中。執筆中の「悩みを集めて、値段をつける」の知見をベースに、AIがマネタイズの相談に答えます。
            </p>
            <div className="mt-4 flex gap-4">
              <a href="https://note.com/yukawasa/n/nd8793681dc1c" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 transition-colors hover:text-zinc-700">
                開発ストーリー &rarr;
              </a>
              <a href="https://note.com/yukawasa" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 transition-colors hover:text-zinc-700">
                note &rarr;
              </a>
            </div>
          </div>
        </div>
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
      {showShareModal && shareUrl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 sm:items-center">
          <div className="mb-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl sm:mb-0">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900">
                この会話をシェア
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {/* X */}
              <button
                onClick={shareToX}
                className="flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors hover:bg-zinc-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black">
                  <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <span className="text-xs text-zinc-600">X</span>
              </button>
              {/* LINE */}
              <button
                onClick={shareToLine}
                className="flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors hover:bg-zinc-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#06C755]">
                  <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                </div>
                <span className="text-xs text-zinc-600">LINE</span>
              </button>
              {/* Facebook */}
              <button
                onClick={shareToFacebook}
                className="flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors hover:bg-zinc-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1877F2]">
                  <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </div>
                <span className="text-xs text-zinc-600">Facebook</span>
              </button>
              {/* Email */}
              <button
                onClick={shareToEmail}
                className="flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors hover:bg-zinc-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-5 w-5">
                    <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
                    <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
                  </svg>
                </div>
                <span className="text-xs text-zinc-600">メール</span>
              </button>
            </div>
            {/* リンクコピー */}
            <button
              onClick={copyShareLink}
              className="mt-4 flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition-colors hover:bg-zinc-100"
            >
              <span className="truncate text-sm text-zinc-500">{shareUrl}</span>
              <span className="ml-3 shrink-0 text-xs font-medium text-zinc-700">
                {shareLinkCopied ? "コピー済み" : "コピー"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
