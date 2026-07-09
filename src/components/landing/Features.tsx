const FEATURES = [
  {
    title: "Layers",
    description:
      "Multi-layer raster canvas with opacity, blend modes, trace tinting, and image import for reference tracing.",
  },
  {
    title: "Scale",
    description:
      "Set architectural scale, draw dimension lines, chain measurements, and auto-generate room schedules.",
  },
  {
    title: "3D Massing",
    description:
      "Extrude footprints, push/pull regions, sketch on elevations, and export back to 2D layers.",
  },
  {
    title: "Export",
    description:
      "Flatten visible layers to PNG with timestamp stamp. Cloud storage keeps every export safe.",
  },
];

export function Features() {
  return (
    <section className="features">
      {FEATURES.map((feature) => (
        <article key={feature.title} className="feature-card">
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </article>
      ))}
    </section>
  );
}
