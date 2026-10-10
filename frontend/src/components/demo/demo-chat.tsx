import { useEffect, useRef, useState } from "react";
import type { ChatStatus } from "ai";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import type { DemoMessage } from "@/lib/demo/types";

export function DemoChat({ messages, pending, onReply }: { messages: DemoMessage[]; pending: boolean; onReply: (text: string) => Promise<void> }) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const status: ChatStatus = pending ? "submitted" : "ready";
  useEffect(() => { if (!pending) textareaRef.current?.focus(); }, [pending, messages.length]);
  const submit = async (text: string) => {
    const clean = text.trim();
    if (!clean || pending) return;
    setDraft("");
    await onReply(clean);
  };
  const options = messages.at(-1)?.role === "assistant" ? messages.at(-1)?.options : undefined;
  return <div className="demo-chat-shell">
    <Conversation className="demo-conversation"><ConversationContent className="demo-message-list">
      {messages.map((message) => <Message from={message.role} key={message.id}><MessageContent>{message.role === "assistant" ? <MessageResponse>{message.text}</MessageResponse> : message.text}</MessageContent></Message>)}
      {pending && <Message from="assistant"><MessageContent><Shimmer className="text-muted-foreground">Thinking...</Shimmer></MessageContent></Message>}
    </ConversationContent><ConversationScrollButton aria-label="Scroll to latest message" /></Conversation>
    {options && <div className="demo-quick-replies">{options.map((option) => <Button variant="outline" size="sm" key={option} onClick={() => void submit(option)} disabled={pending}>{option}</Button>)}</div>}
    <PromptInput className="demo-prompt" onSubmit={({ text }) => submit(text)}>
      <PromptInputTextarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.currentTarget.value)} maxLength={1000} placeholder="Share what matters to you…" />
      <PromptInputFooter className="justify-end"><PromptInputSubmit status={status} disabled={!draft.trim() || pending} /></PromptInputFooter>
    </PromptInput>
  </div>;
}
