import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  attachLayerRasterUrls,
  layerRasterPath,
  type StudioDocument,
} from "@/lib/projects/document";
import { uploadToStorage } from "@/lib/storage";
import {
  legacyStudioFromProjectDocument,
  projectDocumentFromLegacyStudio,
  type ProjectDocument,
} from "@/features/projects/domain/project-document";
import { migrateProjectDocument } from "@/features/projects/domain/project-document-migrations";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "@/features/projects/domain/project-document-schema";
import { projectDocumentSchema } from "@/features/projects/domain/project-document-schema";

type RouteContext = { params: Promise<{ id: string }> };

export const maxDuration = 60;

function readStudioDocument(metadata: Record<string, unknown> | null | undefined) {
  const doc = metadata?.studio_document;
  if (!doc || typeof doc !== "object") return null;
  return doc as StudioDocument;
}

function readProjectDocument(
  metadata: Record<string, unknown> | null | undefined,
): ProjectDocument | null {
  const doc = metadata?.project_document;
  if (!doc || typeof doc !== "object") return null;
  try {
    return migrateProjectDocument(doc);
  } catch {
    return null;
  }
}

function isProjectDocumentBody(value: unknown): value is ProjectDocument {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.schemaVersion === "number" &&
    typeof record.projectId === "string" &&
    record.canvas != null &&
    record.scene != null
  );
}

function isLegacyManifest(
  value: unknown,
): value is StudioDocument & { layer_count?: number } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.doc != null &&
    typeof record.doc === "object" &&
    Array.isArray(record.layers) &&
    record.schemaVersion == null
  );
}

function studioToSavedLayers(
  manifest: StudioDocument & { layer_count?: number },
  existing: StudioDocument | null,
  uploadedPaths: Map<number, string>,
): StudioDocument["layers"] {
  const layerCount = manifest.layer_count ?? manifest.layers?.length ?? 0;
  const savedLayers: StudioDocument["layers"] = [];

  for (let i = 0; i < layerCount; i++) {
    const meta = manifest.layers?.[i];
    const raster_path =
      uploadedPaths.get(i) ??
      meta?.raster_path ??
      existing?.layers?.[i]?.raster_path ??
      null;

    if (!raster_path) {
      throw new Error(`Missing raster for layer ${i}`);
    }

    savedLayers.push({
      name: meta?.name || `Layer ${i + 1}`,
      visible: meta?.visible !== false,
      opacity: meta?.opacity ?? 1,
      trace: meta?.trace ?? 0,
      blendMode: meta?.blendMode || "source-over",
      raster_path,
    });
  }

  return savedLayers;
}

function buildStudioDocument(
  manifest: StudioDocument & { layer_count?: number },
  savedLayers: StudioDocument["layers"],
): StudioDocument {
  return {
    version: manifest.version ?? 1,
    savedAt: manifest.savedAt ?? Date.now(),
    doc: manifest.doc,
    infiniteCanvas: manifest.infiniteCanvas,
    autoExpandCanvas: false,
    paperBg: manifest.paperBg,
    grid: manifest.grid,
    activeLayer: manifest.activeLayer,
    pxPerUnit: manifest.pxPerUnit,
    scaleUnit: manifest.scaleUnit,
    scaleLabel: manifest.scaleLabel ?? null,
    measurements: manifest.measurements,
    walls: manifest.walls,
    wallsVisible: manifest.wallsVisible,
    shapes: manifest.shapes,
    masses: manifest.masses,
    massBaseAnchor: manifest.massBaseAnchor,
    layers: savedLayers,
  };
}

async function parsePutBody(request: Request): Promise<{
  mode: "project-document" | "legacy";
  baseRevision: number;
  mutationVersion: number;
  clientMutationId: string;
  schemaVersion: number;
  checksum?: string;
  document?: ProjectDocument;
  legacyManifest?: StudioDocument & { layer_count?: number };
  files: Map<number, Blob>;
} | null> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const manifestRaw = formData.get("manifest");
    if (typeof manifestRaw !== "string") return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestRaw);
    } catch {
      return null;
    }

    const files = new Map<number, Blob>();
    if (isProjectDocumentBody(parsed) || (parsed && typeof parsed === "object" && "document" in (parsed as object))) {
      const envelope = parsed as Record<string, unknown>;
      const doc = (envelope.document ?? parsed) as ProjectDocument;
      const legacy = legacyStudioFromProjectDocument(doc);
      const layerCount = legacy.layers?.length ?? 0;
      for (let i = 0; i < layerCount; i++) {
        const file = formData.get(`layer_${i}`);
        if (file instanceof Blob && file.size > 0) files.set(i, file);
      }
      return {
        mode: "project-document",
        baseRevision: Number(envelope.baseRevision ?? 0),
        mutationVersion: Number(envelope.mutationVersion ?? 0),
        clientMutationId: String(envelope.clientMutationId ?? crypto.randomUUID()),
        schemaVersion: Number(envelope.schemaVersion ?? CURRENT_PROJECT_SCHEMA_VERSION),
        checksum: typeof envelope.checksum === "string" ? envelope.checksum : undefined,
        document: doc,
        files,
      };
    }

    if (!isLegacyManifest(parsed)) return null;
    const layerCount = parsed.layer_count ?? parsed.layers?.length ?? 0;
    for (let i = 0; i < layerCount; i++) {
      const file = formData.get(`layer_${i}`);
      if (file instanceof Blob && file.size > 0) files.set(i, file);
    }
    return {
      mode: "legacy",
      baseRevision: 0,
      mutationVersion: 0,
      clientMutationId: crypto.randomUUID(),
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      legacyManifest: parsed,
      files,
    };
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;

  // New contract: { baseRevision, document, ... }
  if (record.document != null && typeof record.document === "object") {
    return {
      mode: "project-document",
      baseRevision: Number(record.baseRevision ?? 0),
      mutationVersion: Number(record.mutationVersion ?? 0),
      clientMutationId: String(record.clientMutationId ?? crypto.randomUUID()),
      schemaVersion: Number(record.schemaVersion ?? CURRENT_PROJECT_SCHEMA_VERSION),
      checksum: typeof record.checksum === "string" ? record.checksum : undefined,
      document: record.document as ProjectDocument,
      files: new Map(),
    };
  }

  // Bare ProjectDocument
  if (isProjectDocumentBody(body)) {
    return {
      mode: "project-document",
      baseRevision: Number(record.baseRevision ?? 0),
      mutationVersion: Number(record.mutationVersion ?? 0),
      clientMutationId: String(record.clientMutationId ?? crypto.randomUUID()),
      schemaVersion: Number(record.schemaVersion ?? body.schemaVersion),
      document: body,
      files: new Map(),
    };
  }

  // Legacy StudioDocument PUT
  if (isLegacyManifest(body)) {
    return {
      mode: "legacy",
      baseRevision: Number(record.baseRevision ?? 0),
      mutationVersion: Number(record.mutationVersion ?? 0),
      clientMutationId: String(record.clientMutationId ?? crypto.randomUUID()),
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      legacyManifest: body,
      files: new Map(),
    };
  }

  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("metadata, updated_at, title, created_at")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const metadata = (project.metadata || {}) as Record<string, unknown>;
  const revision = Number(metadata.document_revision ?? 0) || 0;

  let projectDoc = readProjectDocument(metadata);
  const studioDoc = readStudioDocument(metadata);

  // Prefer studio_document when the canonical ProjectDocument lost layer rasters
  // (caused by an earlier bug that saved empty legacyStudio.layers).
  const legacyLayers = (
    projectDoc?.extensions?.legacyStudio as { layers?: unknown[] } | undefined
  )?.layers;
  const projectLayersBroken =
    !!projectDoc && (!Array.isArray(legacyLayers) || legacyLayers.length === 0);

  if ((!projectDoc || projectLayersBroken) && studioDoc?.layers?.length) {
    projectDoc = projectDocumentFromLegacyStudio(projectId, studioDoc, {
      name: project.title,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    });
  }

  if (!projectDoc) {
    return NextResponse.json(null);
  }

  // Attach signed raster URLs into legacyStudio for engine hydrate
  const legacy = legacyStudioFromProjectDocument(projectDoc);
  if (legacy.layers?.length) {
    const withUrls = await attachLayerRasterUrls(supabase, legacy as StudioDocument);
    projectDoc = {
      ...projectDoc,
      extensions: {
        ...(projectDoc.extensions || {}),
        legacyStudio: withUrls,
      },
    };
  }

  return NextResponse.json({
    projectId,
    revision,
    schemaVersion: projectDoc.schemaVersion ?? CURRENT_PROJECT_SCHEMA_VERSION,
    updatedAt: project.updated_at,
    document: projectDoc,
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, metadata, title, created_at")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = await parsePutBody(request);
  if (!parsed) {
    return NextResponse.json(
      {
        code: "INVALID_PROJECT_DOCUMENT",
        message: "Missing or invalid save payload.",
        issues: [],
      },
      { status: 400 },
    );
  }

  const existingMeta = (project.metadata || {}) as Record<string, unknown>;
  const currentRevision = Number(existingMeta.document_revision ?? 0) || 0;

  // Optimistic concurrency (new clients send baseRevision; legacy defaults to 0
  // and is accepted only when server is also 0, otherwise still allow legacy
  // saves when clientMutationId path is legacy-only with matching revision).
  if (parsed.mode === "project-document" && parsed.baseRevision !== currentRevision) {
    return NextResponse.json(
      {
        code: "PROJECT_REVISION_CONFLICT",
        message: "The project has been modified by another client.",
        expectedRevision: parsed.baseRevision,
        currentRevision,
      },
      { status: 409 },
    );
  }

  const existingStudioDocument = readStudioDocument(existingMeta);
  const uploadedPaths = new Map<number, string>();

  // Upload any multipart layer files first
  for (const [index, file] of parsed.files.entries()) {
    const raster_path = layerRasterPath(user.id, projectId, index);
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadToStorage(
      "layer-rasters",
      raster_path,
      buffer,
      file.type || "image/png",
    );
    if (!uploaded) {
      return NextResponse.json({ error: "Layer upload failed" }, { status: 500 });
    }
    uploadedPaths.set(index, raster_path);
  }

  let studio_document: StudioDocument;
  let project_document: ProjectDocument;

  try {
    if (parsed.mode === "project-document" && parsed.document) {
      let doc = migrateProjectDocument(parsed.document);
      const parsedSchema = projectDocumentSchema.safeParse(doc);
      if (!parsedSchema.success) {
        return NextResponse.json(
          {
            code: "INVALID_PROJECT_DOCUMENT",
            message: "The project document failed validation.",
            issues: parsedSchema.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
          { status: 400 },
        );
      }
      doc = parsedSchema.data as ProjectDocument;

      const legacy = legacyStudioFromProjectDocument(doc);
      const savedLayers = studioToSavedLayers(
        { ...legacy, layer_count: legacy.layers.length },
        existingStudioDocument,
        uploadedPaths,
      );
      studio_document = buildStudioDocument(
        { ...legacy, version: legacy.version ?? 1, savedAt: Date.now() },
        savedLayers,
      );
      project_document = projectDocumentFromLegacyStudio(projectId, studio_document, {
        name: doc.metadata?.name || project.title,
        createdAt: doc.metadata?.createdAt || project.created_at,
        updatedAt: new Date().toISOString(),
        scale: doc.canvas.scale,
        scaleLabel: studio_document.scaleLabel,
        scaleUnit: studio_document.scaleUnit,
        infiniteCanvas: studio_document.infiniteCanvas,
        paperBg: studio_document.paperBg,
      });
    } else if (parsed.legacyManifest) {
      const savedLayers = studioToSavedLayers(
        parsed.legacyManifest,
        existingStudioDocument,
        uploadedPaths,
      );
      studio_document = buildStudioDocument(parsed.legacyManifest, savedLayers);
      project_document = projectDocumentFromLegacyStudio(projectId, studio_document, {
        name: project.title,
        createdAt: project.created_at,
        updatedAt: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        {
          code: "INVALID_PROJECT_DOCUMENT",
          message: "The project document failed validation.",
          issues: [],
        },
        { status: 400 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid document";
    if (message.startsWith("Missing raster")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(
      {
        code: "INVALID_PROJECT_DOCUMENT",
        message,
        issues: [],
      },
      { status: 400 },
    );
  }

  const nextRevision = currentRevision + 1;
  const savedAt = new Date().toISOString();

  const nextMetadata = {
    ...existingMeta,
    studio_document,
    project_document,
    document_revision: nextRevision,
  };

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      metadata: nextMetadata,
      doc_width_mm: studio_document.doc?.wmm,
      doc_height_mm: studio_document.doc?.hmm,
      doc_dpi: studio_document.doc?.dpi,
      scale_label: studio_document.scaleLabel ?? null,
      updated_at: savedAt,
    })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Best-effort column sync when migration 003 is applied
  void supabase
    .from("projects")
    .update({ document_revision: nextRevision })
    .eq("id", projectId)
    .eq("user_id", user.id);

  return NextResponse.json({
    projectId,
    revision: nextRevision,
    savedAt,
    clientMutationId: parsed.clientMutationId,
    // Back-compat for older engine clients
    ok: true,
  });
}
