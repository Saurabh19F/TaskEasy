import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light';
type SidebarState = 'expanded' | 'collapsed';

interface UiState {
  theme: Theme;
  sidebar: SidebarState;
  isMobileMenuOpen: boolean;

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebar: (state: SidebarState) => void;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebar: 'expanded',
      isMobileMenuOpen: false,

      setTheme: () => set({ theme: 'light' }),
      toggleSidebar: () =>
        set((s) => ({ sidebar: s.sidebar === 'expanded' ? 'collapsed' : 'expanded' })),
      setSidebar: (sidebar) => set({ sidebar }),
      setMobileMenuOpen: (isMobileMenuOpen) => set({ isMobileMenuOpen }),
    }),
    { name: 'taskeasy-ui' },
  ),
);
