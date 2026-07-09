import Link from "next/link";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Features />
      </main>
      <footer
        style={{
          textAlign: "center",
          padding: "32px 24px",
          color: "var(--muted)",
          fontSize: 12,
        }}
      >
        Built by NM Studio ·{" "}
        <Link href="/login" style={{ color: "var(--brand)", fontWeight: 600 }}>
          Sign in
        </Link>
      </footer>
    </>
  );
}
