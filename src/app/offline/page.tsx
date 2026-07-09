import Link from "next/link";

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        gap: 16,
      }}
    >
      <h1 style={{ fontWeight: 800, fontSize: "1.5rem" }}>You&apos;re offline</h1>
      <p style={{ color: "var(--muted)", maxWidth: 400 }}>
        SketchTrude works offline after your first visit. Open a project from
        your dashboard when you&apos;re back online, or launch the installed app.
      </p>
      <Link href="/dashboard" className="btn-primary">
        Go to Dashboard
      </Link>
    </div>
  );
}
