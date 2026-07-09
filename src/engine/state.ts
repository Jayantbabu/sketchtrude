import { create } from "zustand";
import type { StudioMode, StudioTool } from "@/lib/types";

export type StudioState = {
  projectId: string | null;
  mode: StudioMode;
  tool: StudioTool;
  isOnline: boolean;
  syncStatus: "idle" | "syncing" | "synced" | "error";
  setProjectId: (id: string) => void;
  setMode: (mode: StudioMode) => void;
  setTool: (tool: StudioTool) => void;
  setOnline: (online: boolean) => void;
  setSyncStatus: (status: StudioState["syncStatus"]) => void;
};

export const useStudioStore = create<StudioState>((set) => ({
  projectId: null,
  mode: "draw",
  tool: "pen",
  isOnline: true,
  syncStatus: "idle",
  setProjectId: (id) => set({ projectId: id }),
  setMode: (mode) => set({ mode }),
  setTool: (tool) => set({ tool }),
  setOnline: (online) => set({ isOnline: online }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
}));
