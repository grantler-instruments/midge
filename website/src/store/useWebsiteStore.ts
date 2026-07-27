import { create } from "zustand";

type WebsiteState = {
  menuOpen: boolean;
  supportOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  toggleMenu: () => void;
  setSupportOpen: (open: boolean) => void;
  openSupport: () => void;
};

export const useWebsiteStore = create<WebsiteState>((set) => ({
  menuOpen: false,
  supportOpen: false,
  setMenuOpen: (open) => set({ menuOpen: open }),
  toggleMenu: () => set((state) => ({ menuOpen: !state.menuOpen })),
  setSupportOpen: (open) => set({ supportOpen: open }),
  openSupport: () => set({ menuOpen: false, supportOpen: true }),
}));
