import { Bot, User as UserIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { AIMessage } from '@/lib/types';

export function ChatBubble({ message, streaming = false }: { message: AIMessage; streaming?: boolean }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          isUser ? 'bg-surface-2 text-muted' : 'bg-brand/15 text-brand-light'
        )}
      >
        {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      <div
        className={cn(
          'max-w-[75%] rounded-lg border px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'border-brand/25 bg-brand/10 text-foreground'
            : 'border-border bg-surface text-foreground'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown>{message.content || (streaming ? '…' : '')}</ReactMarkdown>
          </div>
        )}
        {streaming && (
          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse-slow bg-brand-light align-middle" />
        )}
      </div>
    </div>
  );
}
