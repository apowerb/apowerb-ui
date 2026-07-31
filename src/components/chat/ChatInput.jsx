"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "use-intl";
import { Send, Square, Loader2, Headphones } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChat } from "@/hooks/useChat";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useChatContext } from "@/contexts/ChatContext";
import { useMarkdownTextarea } from "@/hooks/useMarkdownTextarea";
import FileUploadZone from "./FileUploadZone";
import VoiceInput from "./VoiceInput";
import VoiceConversationModal from "./VoiceConversationModal";
import IntegrationShortcutBar from "./IntegrationShortcutBar";
import MarkdownToolbar from "./MarkdownToolbar";
import { loadDraft, saveDraft } from "@/lib/chatDrafts";

// True when any modal/dialog is open (they render aria-modal="true"). Used to
// keep keyboard-driven focus moves from reaching the composer behind a dialog.
function isModalOpen() {
  if (typeof document === "undefined") return false;
  return !!document.querySelector('[aria-modal="true"]');
}

export default function ChatInput({ editingText, onEditingTextClear }) {
  const t = useTranslations("ChatInput");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  // Index into the user's own message history for ArrowUp/ArrowDown recall.
  // -1 = not navigating (showing the live draft); 0 = most recent, 1 = older…
  const [recallIndex, setRecallIndex] = useState(-1);
  const textareaRef = useRef(null);
  const { sendMessage, isLoading, streamingMessageId, abortStreaming } = useChat();
  const { activeSession } = useChatSessions();
  const { state: chatState } = useChatContext();

  const isStreaming = !!streamingMessageId;
  const sessionId = activeSession?.id;

  // Markdown shortcuts + smart list continuation + URL-over-selection paste
  const {
    handleKeyDown: mdHandleKeyDown,
    handlePaste: mdHandlePaste,
    applyAction: mdApplyAction,
  } = useMarkdownTextarea(textareaRef, { value: input, setValue: setInput });

  // Handle editing text from parent (when user clicks edit on a message)
  const [prevEditingText, setPrevEditingText] = useState(editingText);
  if (editingText && editingText !== prevEditingText) {
    setPrevEditingText(editingText);
    setInput(editingText);
    onEditingTextClear?.();
  }
  if (!editingText && prevEditingText) {
    setPrevEditingText(editingText);
  }
  useEffect(() => {
    if (editingText) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = editingText.length;
          textareaRef.current.selectionEnd = editingText.length;
        }
      }, 0);
    }
  }, [editingText]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        150
      )}px`;
    }
  }, [input]);

  // Autofocus the composer when the agent finishes answering (busy -> idle),
  // so the user can keep typing without reaching for the mouse. A disabled
  // textarea drops focus, so we restore it on the falling edge of activity.
  const isBusy = isLoading || isStreaming;
  const prevBusyRef = useRef(isBusy);
  useEffect(() => {
    const wasBusy = prevBusyRef.current;
    prevBusyRef.current = isBusy;
    if (!wasBusy || isBusy) return; // only on the busy -> idle transition
    if (voiceModalOpen) return; // never yank focus from the voice modal
    if (isModalOpen()) return; // a dialog is open; its focus trap owns the keyboard
    // On touch devices, focusing pops the virtual keyboard unprompted and
    // covers the conversation - match ChatGPT/Claude and skip autofocus there.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)")?.matches
    ) {
      return;
    }
    // Respect a user already typing in another field (e.g. sidebar search).
    const active = document.activeElement;
    if (
      active &&
      active !== textareaRef.current &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable)
    ) {
      return;
    }
    // Defer until the textarea is re-enabled in the committed DOM. preventScroll
    // stops the focus from scroll-jacking a user reading higher up the thread.
    const id = requestAnimationFrame(() =>
      textareaRef.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(id);
  }, [isBusy, voiceModalOpen]);

  // Restore the saved draft when the active session changes (and on mount), so
  // switching threads or reloading never loses what you were typing. Per-key
  // saving happens in the textarea onChange; the draft is cleared on send.
  useEffect(() => {
    if (editingText) return; // do not clobber an in-progress message edit
    setInput(loadDraft(sessionId));
    setRecallIndex(-1); // a different thread has its own history
    // editingText is read as a guard, not a trigger: restore must fire only on
    // session change, never when an edit starts or ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Press "/" anywhere outside a text field to jump into the composer
  // (GitHub/Slack convention). Never hijacks "/" while you are typing.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isLoading || isStreaming || voiceModalOpen) return;
      if (isModalOpen()) return; // never focus the composer behind an open dialog
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }
      const el = textareaRef.current;
      if (el) {
        e.preventDefault();
        el.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isLoading, isStreaming, voiceModalOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!input.trim() && files.length === 0) || isLoading || isStreaming) return;

    const message = input;
    const attachedFiles = files.filter((f) => f.file);

    setInput("");
    setFiles([]);
    setRecallIndex(-1); // sending resets history navigation
    saveDraft(sessionId, ""); // a sent message is no longer a draft

    // Send with optional file attachments
    await sendMessage(message, attachedFiles.length > 0 ? attachedFiles : undefined);
  };

  // The user's own messages, oldest→newest, for ArrowUp/ArrowDown history recall.
  const userMessages = useMemo(() => {
    const msgs = activeSession?.messages || [];
    return msgs
      .filter(
        (m) =>
          m.role === "user" && typeof m.content === "string" && m.content.trim(),
      )
      .map((m) => m.content);
  }, [activeSession]);

  // Cancel a pending caret-placement frame if we unmount first.
  const recallRafRef = useRef(0);
  useEffect(() => () => cancelAnimationFrame(recallRafRef.current), []);

  // Show the history entry at `idx` (0 = most recent) and park the caret at the
  // end so the recalled text is immediately editable.
  const applyRecall = useCallback(
    (idx) => {
      const text = userMessages[userMessages.length - 1 - idx];
      if (text == null) return;
      setRecallIndex(idx);
      setInput(text);
      recallRafRef.current = requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus({ preventScroll: true });
          el.selectionStart = el.selectionEnd = text.length;
        }
      });
    },
    [userMessages],
  );

  const handleKeyDown = (e) => {
    const el = textareaRef.current;
    const busy = isLoading || isStreaming;
    const inRecall = recallIndex >= 0;

    // ArrowUp walks back through your own message history (terminal / ChatGPT
    // reflex): once from an empty composer, then further up on each press.
    // Gated on the caret being on the first line so it never hijacks caret
    // navigation inside a multi-line draft, and skipped during IME composition.
    if (e.key === "ArrowUp" && !e.nativeEvent?.isComposing && !busy) {
      const caretOnFirstLine =
        el &&
        el.selectionStart === el.selectionEnd &&
        !el.value.slice(0, el.selectionStart).includes("\n");
      if ((input === "" || inRecall) && caretOnFirstLine && userMessages.length) {
        e.preventDefault();
        const nextIdx = Math.min(recallIndex + 1, userMessages.length - 1);
        if (nextIdx !== recallIndex) applyRecall(nextIdx);
        return; // already at the oldest — swallow so the caret doesn't jump
      }
    }

    // ArrowDown unwinds the recall: back toward your most recent message, then
    // past it to the live (empty) composer. Only while navigating, on the last
    // line, so it never hijacks caret movement inside a multi-line draft.
    if (e.key === "ArrowDown" && !e.nativeEvent?.isComposing && inRecall && !busy) {
      const caretOnLastLine =
        el &&
        el.selectionStart === el.selectionEnd &&
        !el.value.slice(el.selectionEnd).includes("\n");
      if (caretOnLastLine) {
        e.preventDefault();
        const nextIdx = recallIndex - 1;
        if (nextIdx < 0) {
          setRecallIndex(-1);
          setInput("");
        } else {
          applyRecall(nextIdx);
        }
        return;
      }
    }

    // Markdown shortcuts + smart list continuation get first dibs.
    if (mdHandleKeyDown(e)) return;
    // Cmd/Ctrl+Enter sends even inside a list line.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Handle paste: first try URL-over-selection (markdown), then fall back
  // to file paste (images, etc.).
  const handlePaste = useCallback(
    (e) => {
      if (mdHandlePaste(e)) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles = [];
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        const newFiles = pastedFiles.map((f) => {
          const fileObj = {
            id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            name: f.name || `paste_${Date.now()}.png`,
            type: f.type,
            size: f.size,
            file: f,
            preview: null,
            base64: null,
          };
          const reader = new FileReader();
          reader.onload = (ev) => {
            fileObj.base64 = ev.target.result;
            if (f.type.startsWith("image/")) fileObj.preview = ev.target.result;
            setFiles((prev) => [...prev]);
          };
          reader.readAsDataURL(f);
          return fileObj;
        });
        setFiles((prev) => [...prev, ...newFiles]);
      }
    },
    [mdHandlePaste],
  );

  const handleVoiceTranscript = useCallback((text, isFinal) => {
    setInput(text);
    saveDraft(sessionId, text);
    if (isFinal && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [sessionId]);

  if (!activeSession) {
    return null;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border-t th-border-secondary th-bg-sidebar"
    >
      {/* Integration shortcuts (Integrations button + active-mailbox switcher) */}
      <IntegrationShortcutBar />

      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-2 py-1.5 th-bg-surface border th-border rounded-lg"
            >
              {file.preview ? (
                <img
                  src={file.preview}
                  alt={file.name}
                  className="w-8 h-8 rounded object-cover"
                />
              ) : (
                <span className="text-[11px] th-text-faint">{file.name.slice(-10)}</span>
              )}
              <span className="text-[11px] th-text-muted truncate max-w-[100px]">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((f) => f.id !== file.id))}
                className="th-text-ghost hover:th-text-muted text-xs"
                aria-label={t("removeFile")}
              >
                {t("removeFile")}
              </button>
              {chatState.uploadProgress.get(file.id) != null && chatState.uploadProgress.get(file.id) < 100 && (
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${chatState.uploadProgress.get(file.id)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* File upload button (left) */}
        <FileUploadZone
          files={[]}
          onFilesChange={(updater) => setFiles(updater)}
          disabled={isLoading || isStreaming}
        />

        {/* Textarea / markdown editor (center, flexible) */}
        <div className="flex-1 relative">
          <MarkdownToolbar
            onAction={mdApplyAction}
            previewMode={previewMode}
            onTogglePreview={
              input.trim() ? () => setPreviewMode((v) => !v) : undefined
            }
            disabled={isLoading || isStreaming}
          />
          {previewMode ? (
            <div
              className="w-full glass-input px-4 py-3 rounded-xl min-h-[44px] max-h-[150px] overflow-y-auto text-sm markdown-content"
              role="region"
              aria-label={t("markdownPreview")}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {input || t("emptyPreview")}
              </ReactMarkdown>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                saveDraft(sessionId, e.target.value);
                if (recallIndex !== -1) setRecallIndex(-1); // typing leaves history
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={t("placeholder")}
              disabled={isLoading || isStreaming}
              rows={1}
              className="w-full glass-input px-4 py-3 rounded-xl resize-none transition-all disabled:opacity-50 leading-relaxed"
            />
          )}
        </div>

        {/* Dictation (Web Speech API) */}
        <VoiceInput
          onTranscript={handleVoiceTranscript}
          disabled={isLoading || isStreaming}
        />

        {/* Voice conversation (full-screen modal) */}
        <button
          type="button"
          onClick={() => setVoiceModalOpen(true)}
          disabled={!activeSession?.id || isLoading || isStreaming}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full th-bg-surface hover:th-bg-surface-hover th-text-faint hover:th-text-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title={t("startVoiceConversation")}
          aria-label={t("startVoiceConversation")}
        >
          <Headphones size={18} />
        </button>

        {/* Send / Stop button (far right) */}
        {isStreaming ? (
          <button
            type="button"
            onClick={abortStreaming}
            className="shrink-0 w-10 h-10 flex items-center justify-center bg-red-600 hover:bg-red-500 text-white rounded-full transition-all"
            title={t("stopGenerating")}
          >
            <Square size={20} className="fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={(!input.trim() && files.length === 0) || isLoading}
            className="btn-brand shrink-0 w-10 h-10 flex items-center justify-center text-white rounded-full shadow-lg shadow-brand/20"
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        )}
      </div>

      {/* Keyboard affordances — surface the otherwise-invisible shortcuts so
          users discover history recall, quick-focus and the palette. */}
      {!input && !isLoading && !isStreaming && !previewMode && (
        <div className="mt-1.5 px-1 hidden sm:flex items-center gap-3 text-[10px] th-text-ghost select-none">
          <span>
            <kbd className="th-text-faint">↑</kbd> {t("historyHint")}
          </span>
          <span>
            <kbd className="th-text-faint">/</kbd> {t("typeHint")}
          </span>
          <span>
            <kbd className="th-text-faint">⌘K</kbd> {t("navigateHint")}
          </span>
        </div>
      )}

      <VoiceConversationModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        sessionId={activeSession?.id}
        agentName={activeSession?.agentId}
        agentDisplayName={activeSession?.agentName}
      />
    </form>
  );
}
