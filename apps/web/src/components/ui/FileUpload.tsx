'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, X, FileText, Image, AlertCircle, Loader2 } from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import { uploadsApi } from '@/lib/api';
import type { UploadResult } from '@/types';

interface UploadedFile {
  result: UploadResult;
  localFile: File;
}

interface FileUploadProps {
  /** Called whenever the list of uploaded files changes */
  onChange: (publicIds: string[]) => void;
  /** Already-uploaded files (e.g. when editing a task) */
  initialPublicIds?: string[];
  accept?: string;
  maxFiles?: number;
  maxSizeBytes?: number;
  label?: string;
  className?: string;
  /** Compact mode: renders a small button + inline file chips instead of the drag-drop zone */
  compact?: boolean;
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="h-4 w-4 text-accent" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function FileUpload({
  onChange, initialPublicIds = [],
  accept, maxFiles = 5,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  label = 'Attachments',
  className,
  compact = false,
}: FileUploadProps) {
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const publish = (files: UploadedFile[]) => {
    onChange(files.map((f) => f.result.publicId));
  };

  const uploadFiles = useCallback(
    async (fileList: File[]) => {
      setErrors([]);

      // Validate
      const errs: string[] = [];
      const valid = fileList.filter((f) => {
        if (uploaded.length + fileList.indexOf(f) + 1 > maxFiles) {
          errs.push(`Max ${maxFiles} files allowed`);
          return false;
        }
        if (f.size > maxSizeBytes) {
          errs.push(`${f.name}: exceeds ${formatFileSize(maxSizeBytes)} limit`);
          return false;
        }
        if (!ALLOWED_MIME_TYPES.includes(f.type)) {
          errs.push(`${f.name}: file type not allowed`);
          return false;
        }
        return true;
      });

      if (errs.length) { setErrors([...new Set(errs)]); }
      if (!valid.length) return;

      setUploading(true);
      try {
        const results = await uploadsApi.uploadMultiple(valid);
        const newFiles = results.map((result, i) => ({ result, localFile: valid[i] }));
        const next = [...uploaded, ...newFiles];
        setUploaded(next);
        publish(next);
      } catch {
        setErrors(['Upload failed. Please try again.']);
      } finally {
        setUploading(false);
      }
    },
    [uploaded, maxFiles, maxSizeBytes],
  );

  const handleRemove = async (publicId: string) => {
    try {
      await uploadsApi.delete(publicId);
    } catch {
      // non-fatal
    }
    const next = uploaded.filter((f) => f.result.publicId !== publicId);
    setUploaded(next);
    publish(next);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      uploadFiles(files);
    },
    [uploadFiles],
  );

  if (compact) {
    return (
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <label className="block text-xs font-medium text-muted-foreground">{label}</label>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept ?? ALLOWED_MIME_TYPES.join(',')}
          className="hidden"
          onChange={(e) => uploadFiles(Array.from(e.target.files ?? []))}
        />
        <button
          type="button"
          onClick={() => !uploading && inputRef.current?.click()}
          disabled={uploading || uploaded.length >= maxFiles}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : uploaded.length >= maxFiles ? `Max ${maxFiles} reached` : 'Attach files'}
        </button>
        {errors.length > 0 && (
          <p className="text-[11px] text-red-500">{errors[0]}</p>
        )}
        {uploaded.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {uploaded.map(({ result }) => (
              <span key={result.publicId} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                <FileText className="h-3 w-3" />
                <span className="max-w-[80px] truncate">{result.originalName}</span>
                <button type="button" onClick={() => handleRemove(result.publicId)} className="hover:text-red-500">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="block text-sm font-semibold text-foreground">
          {label} <span className="text-xs font-normal text-muted-foreground">(optional, max {maxFiles})</span>
        </label>
      )}

      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-[1.25rem] border-2 border-dashed px-4 py-6 text-center transition-all',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border bg-surface hover:border-primary hover:bg-surface-muted/70',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept ?? ALLOWED_MIME_TYPES.join(',')}
          className="hidden"
          onChange={(e) => uploadFiles(Array.from(e.target.files ?? []))}
        />
        {uploading ? (
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
        ) : (
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        )}
        <p className="text-sm text-foreground/80">
          {uploading ? 'Uploading…' : 'Drag & drop files here, or click to browse'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, Images, Word, Excel · max {formatFileSize(maxSizeBytes)} each
        </p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-1 rounded-xl border border-brand/20 bg-brand/10 px-3 py-2">
          {errors.map((e, i) => (
            <p key={i} className="flex items-center gap-1.5 text-xs text-brand">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {e}
            </p>
          ))}
        </div>
      )}

      {/* Uploaded files list */}
      {uploaded.length > 0 && (
        <ul className="space-y-1.5">
          {uploaded.map(({ result, localFile }) => (
            <li
              key={result.publicId}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.45)]"
            >
              {fileIcon(result.mimeType)}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-foreground">{result.originalName}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(result.size)}</p>
              </div>
              <a
                href={result.secureUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-shrink-0 text-xs font-semibold text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(result.publicId); }}
                className="flex-shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-brand/10 hover:text-brand"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
