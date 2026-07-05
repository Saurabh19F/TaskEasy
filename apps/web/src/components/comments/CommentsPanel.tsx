'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Trash2, CornerDownRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { commentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
  parentId: string | null;
  replies?: Comment[];
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-primary text-xs font-bold text-contrast shadow-[0_12px_24px_-16px_rgba(37,99,235,0.32)]">
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function CommentBubble({
  comment,
  currentUserId,
  role,
  onReply,
  onDelete,
  isReply = false,
}: {
  comment: Comment;
  currentUserId: string;
  role: string;
  onReply: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  isReply?: boolean;
}) {
  const canDelete =
    comment.author.id === currentUserId || ['ADMIN'].includes(role);

  return (
    <div className={cn('flex gap-2.5', isReply && 'ml-9 mt-1.5')}>
      <Avatar name={comment.author.name} />
      <div className="flex-1 min-w-0">
        <div className="inline-block max-w-full rounded-2xl bg-surface-muted px-3 py-2 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.5)]">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-xs font-semibold text-foreground">
              {comment.author.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
            {comment.body}
          </p>
        </div>

        <div className="flex items-center gap-3 mt-1 px-1">
          {!isReply && (
            <button
              onClick={() => onReply(comment.id, comment.author.name)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
            >
              <CornerDownRight className="h-3 w-3" /> Reply
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(comment.id)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-brand"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>

        {/* Replies */}
        {(comment.replies ?? []).map((reply) => (
          <CommentBubble
            key={reply.id}
            comment={reply}
            currentUserId={currentUserId}
            role={role}
            onReply={onReply}
            onDelete={onDelete}
            isReply
          />
        ))}
      </div>
    </div>
  );
}

interface CommentsPanelProps {
  refId: string;
  refType: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS_STEP';
}

export function CommentsPanel({ refId, refType }: CommentsPanelProps) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', refId],
    queryFn: () => commentsApi.findByRef(refId),
    enabled: !!refId,
    staleTime: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      commentsApi.create({
        body: body.trim(),
        refId,
        refType,
        parentId: replyTo?.id,
      }),
    onSuccess: () => {
      setBody('');
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ['comments', refId] });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    },
    onError: () => toast.error('Could not post comment'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => commentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', refId] }),
    onError: () => toast.error('Could not delete comment'),
  });

  const handleReply = (id: string, name: string) => {
    setReplyTo({ id, name });
    textareaRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    createMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (body.trim()) createMutation.mutate();
    }
  };

  // Top-level comments only (replies are nested inside)
  const topLevel = comments.filter((c: Comment) => !c.parentId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-strong px-4 py-3">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          Comments
        </span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">
          {comments.length}
        </span>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {!isLoading && topLevel.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No comments yet — be the first!</p>
          </div>
        )}
        {topLevel.map((comment: Comment) => (
          <CommentBubble
            key={comment.id}
            comment={comment}
            currentUserId={user?.sub ?? ''}
            role={user?.role ?? ''}
            onReply={handleReply}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-surface-strong p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-1.5 text-primary">
            <span className="text-xs">
              <CornerDownRight className="inline h-3 w-3 mr-1" />
              Replying to <strong>{replyTo.name}</strong>
            </span>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
              <span className="text-xs">✕</span>
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Avatar name={user?.name ?? 'U'} />
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a comment… (Ctrl+Enter to send)"
              rows={2}
              className="w-full resize-none rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition"
            />
          </div>
          <button
            type="submit"
            disabled={!body.trim() || createMutation.isPending}
            className="self-end rounded-2xl bg-primary p-2.5 text-contrast transition-all hover:-translate-y-0.5 hover:bg-brand disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
