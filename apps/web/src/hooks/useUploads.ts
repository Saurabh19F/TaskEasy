import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { uploadsApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';
import type { UploadResult } from '@/types';

export function useUploadSingle(options?: { onSuccess?: (result: UploadResult) => void }) {
  return useMutation({
    mutationFn: (file: File) => uploadsApi.uploadSingle(file),
    onSuccess: (result) => {
      options?.onSuccess?.(result);
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useUploadMultiple(options?: { onSuccess?: (results: UploadResult[]) => void }) {
  return useMutation({
    mutationFn: (files: File[]) => uploadsApi.uploadMultiple(files),
    onSuccess: (results) => {
      options?.onSuccess?.(results);
    },
    onError: (err) => toast.error(getApiError(err)),
  });
}

export function useDeleteUpload() {
  return useMutation({
    mutationFn: (publicId: string) => uploadsApi.delete(publicId),
    onSuccess: () => toast.success('File removed'),
    onError: (err) => toast.error(getApiError(err)),
  });
}
