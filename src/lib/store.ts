import { create } from "zustand";
import type { NeedId } from "@/data/services";
import { MAX_NEEDS } from "@/data/services";
import type { ProfileId } from "@/data/profiles";
import { scrollToId } from "@/lib/utils";

type AppState = {
  selectedNeeds: NeedId[];
  profile: ProfileId | null;
  serviceModal: NeedId | null;
  partnerModal: string | null;
  mobileNav: boolean;
  toggleNeed: (id: NeedId) => void;
  addNeed: (id: NeedId) => void;
  setNeeds: (ids: NeedId[]) => void;
  setProfile: (id: ProfileId | null) => void;
  openService: (id: NeedId | null) => void;
  openPartner: (id: string | null) => void;
  setMobileNav: (open: boolean) => void;
  goToForm: (preselect?: NeedId[], profile?: ProfileId | null) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  selectedNeeds: [],
  profile: null,
  serviceModal: null,
  partnerModal: null,
  mobileNav: false,
  toggleNeed: (id) => {
    const current = get().selectedNeeds;
    if (current.includes(id)) {
      set({ selectedNeeds: current.filter((item) => item !== id) });
      return;
    }
    if (current.length >= MAX_NEEDS) return;
    set({ selectedNeeds: [...current, id] });
  },
  addNeed: (id) => {
    const current = get().selectedNeeds;
    if (current.includes(id) || current.length >= MAX_NEEDS) return;
    set({ selectedNeeds: [...current, id] });
  },
  setNeeds: (ids) => {
    const unique = [...new Set(ids)].slice(0, MAX_NEEDS);
    set({ selectedNeeds: unique });
  },
  setProfile: (id) => set({ profile: id }),
  openService: (id) => set({ serviceModal: id, partnerModal: null }),
  openPartner: (id) => set({ partnerModal: id, serviceModal: null }),
  setMobileNav: (open) => set({ mobileNav: open }),
  goToForm: (preselect, profile) => {
    const next: Partial<AppState> = {
      serviceModal: null,
      partnerModal: null,
      mobileNav: false,
    };

    if (preselect?.length) {
      const merged = [
        ...new Set([...get().selectedNeeds, ...preselect]),
      ].slice(0, MAX_NEEDS);
      next.selectedNeeds = merged;
    }
    if (profile !== undefined) {
      next.profile = profile;
    }
    set(next);
    requestAnimationFrame(() => scrollToId("demande"));
  },
}));
