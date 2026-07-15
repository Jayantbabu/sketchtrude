/**
 * Canonical state surface for plan alignment.
 * Runtime state lives in scope; this module re-exports it.
 */
export { state, doc, syncDocPx, S } from "./scope";
export type { EngineState, DocConfig, EngineScope } from "./types";
