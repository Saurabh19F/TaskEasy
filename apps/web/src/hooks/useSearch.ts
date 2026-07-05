import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/axios';

export interface SearchResult {
  id: string;
  type: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS' | 'USER' | 'PROJECT';
  title: string;
  subtitle?: string;
  href: string;
}

export function useSearch(query: string) {
  const enabled = query.trim().length >= 2;

  return useQuery<SearchResult[]>({
    queryKey: ['search', query],
    queryFn: () => apiGet<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`),
    enabled,
    staleTime: 30_000,
  });
}
