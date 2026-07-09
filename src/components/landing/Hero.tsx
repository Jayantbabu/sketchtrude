import Link from "next/link";

export function Hero() {
  return (
    <section className="hero">
      <h1>Architectural sketching, scaled and layered.</h1>
      <p>
        Sketch, trace, measure, and mass in 3D — the same studio experience
        you know, now with cloud sync and your projects everywhere.
      </p>
      <div className="hero-actions">
        <Link href="/register" className="btn-primary">
          Get Started — free
        </Link>
        <Link href="/login" className="btn-ghost">
          Open Studio →
        </Link>
      </div>
    </section>
  );
}
