import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="site-brand">
        <Image src="/logo.png" alt="SketchTrude" width={28} height={28} />
        <span>
          SketchTrude <em>/</em>
        </span>
      </Link>
      <nav className="site-nav">
        <Link href="/login" className="btn-ghost">
          Login
        </Link>
        <Link href="/register" className="btn-primary">
          Register
        </Link>
      </nav>
    </header>
  );
}
