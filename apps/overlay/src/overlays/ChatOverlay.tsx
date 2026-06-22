import { useState } from "react";
import type { ChatMessageAddMessage, ChatMessageFragment } from "@streamops/shared";

const i18n = {
  ko: {
    title: "채팅",
    translationLabel: {
      ko: "한국어",
      ja: "일본어"
    }
  },
  ja: {
    title: "チャット",
    translationLabel: {
      ko: "韓国語",
      ja: "日本語"
    }
  }
} as const;

const t = i18n.ko;
const AVATAR_COLORS = ["#06c755", "#00b3a4", "#5b8def", "#f59e0b", "#ef5da8", "#8b5cf6"] as const;

function avatarColor(name: string): string {
  const total = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length] ?? "#06c755";
}

function initial(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? "?";
}

function timeLabel(createdAt: string | undefined): string {
  const date = createdAt ? new Date(createdAt) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function ChatEmote({ fragment }: { fragment: Extract<ChatMessageFragment, { type: "emote" }> }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="chat-fragment-text">{fragment.text}</span>;
  return <img className="chat-emote" src={fragment.imageUrl} alt={fragment.text} title={fragment.text} onError={() => setFailed(true)} />;
}

function ChatBubbleContent({ message }: { message: ChatMessageAddMessage }) {
  const original = !message.fragments?.length ? (
    <span className="chat-fragment-text">{message.message}</span>
  ) : (
    <>
      {message.fragments.map((fragment, index) => {
        if (fragment.type === "emote") {
          return <ChatEmote fragment={fragment} key={`${message.id ?? "chat"}-emote-${fragment.id}-${index}`} />;
        }
        return <span className="chat-fragment-text" key={`${message.id ?? "chat"}-text-${index}`}>{fragment.text}</span>;
      })}
    </>
  );

  return (
    <div className="chat-bubble-content">
      <div className="chat-original">{original}</div>
      {message.translatedMessage && message.translationTargetLanguage ? (
        <div className="chat-translation">
          <span>{t.translationLabel[message.translationTargetLanguage]}</span>
          <strong>{message.translatedMessage}</strong>
        </div>
      ) : null}
    </div>
  );
}

export function ChatOverlay({ messages }: { messages: ChatMessageAddMessage[] }) {
  return (
    <section className="chat-overlay" aria-label={t.title}>
      <div className="chat-body">
        {messages.map((message) => (
          <article className={`chat-message ${message.isBroadcaster ? "broadcaster" : "viewer"}`} key={message.id ?? `${message.userName}-${message.createdAt}-${message.message}`}>
            <div className="chat-avatar" style={{ backgroundColor: avatarColor(message.userName) }}>
              <span>{initial(message.userName)}</span>
              {message.profileImageUrl ? <img src={message.profileImageUrl} alt="" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
            </div>
            <div className="chat-bubble-stack">
              <div className="chat-bubble">
                <div className="chat-meta">
                  <span>{message.userName}</span>
                  <time>{timeLabel(message.createdAt)}</time>
                </div>
                <ChatBubbleContent message={message} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
