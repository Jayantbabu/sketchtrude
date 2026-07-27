import { describe, expect, it } from "vitest";
import {
  createEmptyProjectDocument,
  legacyStudioFromProjectDocument,
  projectDocumentFromLegacyStudio,
  stripLegacyStudioBlobs,
  type LegacyStudioDocument,
} from "@/features/projects/domain/project-document";
import { migrateProjectDocument } from "@/features/projects/domain/project-document-migrations";
import { UnsupportedSchemaVersionError } from "@/features/projects/domain/project-errors";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "@/features/projects/domain/project-document-schema";
import { DirtyStateTracker } from "@/persistence/autosave/dirty-state-tracker";
import { chooseLoadSource } from "@/persistence/recovery/recovery-policy";

describe("createEmptyProjectDocument", () => {
  it("creates a schemaVersion 1 document with legacyStudio extension", () => {
    const doc = createEmptyProjectDocument("proj-1", { name: "Demo" });
    expect(doc.schemaVersion).toBe(CURRENT_PROJECT_SCHEMA_VERSION);
    expect(doc.projectId).toBe("proj-1");
    expect(doc.metadata.name).toBe("Demo");
    expect(doc.canvas.scale).toBeNull();
    expect(doc.scene.rootLayerIds.length).toBe(1);
    expect(doc.extensions?.legacyStudio).toBeTruthy();
    const legacy = doc.extensions!.legacyStudio as LegacyStudioDocument;
    expect(legacy.layers).toHaveLength(1);
    expect(legacy.doc.wmm).toBe(doc.canvas.width);
  });
});

describe("legacy roundtrip", () => {
  it("fromLegacy → toLegacy preserves raster_path and strips blobs", () => {
    const legacy: LegacyStudioDocument = {
      version: 1,
      savedAt: 1_700_000_000_000,
      doc: { wmm: 420, hmm: 297, dpi: 150 },
      infiniteCanvas: true,
      paperBg: "#fff8e1",
      grid: { show: true, type: "ortho", spacingMM: 5 },
      activeLayer: 0,
      pxPerUnit: 12.5,
      scaleUnit: "cm",
      scaleLabel: "1:100",
      measurements: [{ id: 1 }],
      walls: [],
      wallsVisible: true,
      shapes: [],
      masses: [],
      layers: [
        {
          layer_id: "stable-ink-layer",
          name: "Ink",
          visible: true,
          opacity: 0.8,
          trace: 0.2,
          blendMode: "source-over",
          raster_path: "user/proj/layers/0.png",
          raster: { kind: "fake-blob" } as unknown as Blob,
        },
      ],
    };

    const doc = projectDocumentFromLegacyStudio("proj-2", legacy, {
      name: "House",
    });
    expect(doc.metadata.name).toBe("House");
    expect(doc.canvas.infiniteCanvas).toBe(true);
    expect(doc.canvas.background.value).toBe("#fff8e1");
    expect(doc.settings.grid.show).toBe(true);
    expect(doc.settings.scaleLabel).toBe("1:100");
    expect(doc.scene.rootLayerIds).toEqual(["stable-ink-layer"]);
    expect(doc.scene.layers["stable-ink-layer"]?.rasterPath).toBe(
      "user/proj/layers/0.png",
    );

    const stored = doc.extensions?.legacyStudio as LegacyStudioDocument;
    expect(stored.layers[0]?.layer_id).toBe("stable-ink-layer");
    expect(stored.layers[0]?.raster_path).toBe("user/proj/layers/0.png");
    // Live exports may still carry blobs until prepareDocument strips them.
    expect(stored.measurements).toEqual([{ id: 1 }]);

    const stripped = stripLegacyStudioBlobs(stored);
    expect(stripped.layers[0]?.raster).toBeUndefined();
    expect(stripped.layers[0]?.raster_path).toBe("user/proj/layers/0.png");

    const back = legacyStudioFromProjectDocument(doc);
    expect(back.layers[0]?.raster_path).toBe("user/proj/layers/0.png");
    expect(back.doc.wmm).toBe(420);
    expect(back.infiniteCanvas).toBe(true);
    expect(back.scaleLabel).toBe("1:100");
  });
});

describe("migrateProjectDocument", () => {
  it("rejects future schema versions", () => {
    const future = {
      ...createEmptyProjectDocument("proj-3"),
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION + 5,
    };
    expect(() => migrateProjectDocument(future)).toThrow(
      UnsupportedSchemaVersionError,
    );
  });

  it("parses current schema documents", () => {
    const doc = createEmptyProjectDocument("proj-4");
    const migrated = migrateProjectDocument(doc);
    expect(migrated.projectId).toBe("proj-4");
    expect(migrated.schemaVersion).toBe(1);
  });
});

describe("DirtyStateTracker", () => {
  it("tracks dirty and clean-up-to-save-version behavior", () => {
    const tracker = new DirtyStateTracker();
    expect(tracker.isDirty()).toBe(false);

    const v1 = tracker.markDirty();
    expect(v1).toBe(1);
    expect(tracker.isDirty()).toBe(true);
    expect(tracker.getState().dirtySince).not.toBeNull();

    const saveVersion = tracker.captureSaveVersion();
    tracker.markDirty();
    tracker.markSaved(saveVersion);
    expect(tracker.isDirty()).toBe(true);
    expect(tracker.getMutationVersion()).toBe(2);

    tracker.markSaved(2);
    expect(tracker.isDirty()).toBe(false);
    expect(tracker.getState().dirtySince).toBeNull();
  });
});

describe("chooseLoadSource", () => {
  it("uses local when revisions match and local has pending edits", () => {
    const decision = chooseLoadSource(
      {
        valid: true,
        baseServerRevision: 10,
        localMutationVersion: 12,
        lastSyncedMutationVersion: 10,
        syncStatus: "pending",
      },
      { valid: true, revision: 10 },
    );
    expect(decision).toEqual({ source: "local", mode: "resume-sync" });
  });

  it("uses cloud when local is synced and cloud is newer", () => {
    const decision = chooseLoadSource(
      {
        valid: true,
        baseServerRevision: 10,
        localMutationVersion: 10,
        lastSyncedMutationVersion: 10,
        syncStatus: "synced",
      },
      { valid: true, revision: 14 },
    );
    expect(decision).toEqual({ source: "cloud" });
  });

  it("returns conflict when local has unsynced edits and cloud is newer", () => {
    const decision = chooseLoadSource(
      {
        valid: true,
        baseServerRevision: 10,
        localMutationVersion: 13,
        lastSyncedMutationVersion: 10,
        syncStatus: "pending",
      },
      { valid: true, revision: 14 },
    );
    expect(decision).toEqual({ source: "conflict" });
  });

  it("opens local offline when cloud fails", () => {
    const decision = chooseLoadSource(
      {
        valid: true,
        baseServerRevision: 5,
        localMutationVersion: 6,
        lastSyncedMutationVersion: 5,
        syncStatus: "pending",
      },
      { valid: false, revision: 0 },
    );
    expect(decision).toEqual({ source: "local", mode: "offline" });
  });

  it("uses cloud and retains corrupt local when local is corrupt", () => {
    const decision = chooseLoadSource(
      {
        valid: false,
        corrupt: true,
        baseServerRevision: 5,
        localMutationVersion: 0,
        lastSyncedMutationVersion: 0,
        syncStatus: "failed",
      },
      { valid: true, revision: 8 },
    );
    expect(decision).toEqual({ source: "cloud", retainCorruptLocal: true });
  });

  it("treats both-null as an empty new project", () => {
    const decision = chooseLoadSource(null, null);
    expect(decision).toEqual({ source: "empty" });
  });

  it("fails when both sources are present but invalid", () => {
    const decision = chooseLoadSource(
      {
        valid: false,
        corrupt: true,
        baseServerRevision: 0,
        localMutationVersion: 0,
        lastSyncedMutationVersion: 0,
        syncStatus: "failed",
      },
      { valid: false, revision: 0 },
    );
    expect(decision.source).toBe("failure");
  });
});
