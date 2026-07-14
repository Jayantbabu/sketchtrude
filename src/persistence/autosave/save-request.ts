export type SaveReason =
  | "autosave"
  | "manual"
  | "project-switch"
  | "mode-switch"
  | "window-blur"
  | "navigation"
  | "recovery"
  | "before-unload";

const SAVE_REASON_PRIORITY: Record<SaveReason, number> = {
  autosave: 1,
  recovery: 2,
  "mode-switch": 3,
  "window-blur": 4,
  navigation: 5,
  "project-switch": 6,
  "before-unload": 7,
  manual: 8,
};

export function chooseHigherPriority(
  current: SaveReason | null,
  next: SaveReason,
): SaveReason {
  if (!current) return next;
  return SAVE_REASON_PRIORITY[next] >= SAVE_REASON_PRIORITY[current]
    ? next
    : current;
}
