"use client";

import { useEffect, useState } from "react";
import { loadLocalThumbnail } from "@/lib/persistence/thumbnails";

export function ProjectThumbnail({
  projectId,
  remoteUrl,
  title,
}: {
  projectId: string;
  remoteUrl: string | null;
  title: string;
}) {
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    loadLocalThumbnail(projectId).then((url) => {
      if (url) {
        revoked = url;
        setLocalUrl(url);
      }
    });
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [projectId]);

  const src = remoteUrl || localUrl;

  if (!src) {
    return <span className="project-thumb-empty">No preview yet</span>;
  }

  return <img src={src} alt={`${title} preview`} />;
}
