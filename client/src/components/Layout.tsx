import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import {
  LayoutDashboard, Building2, FileText, Receipt, Sun, Moon, Zap, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PerplexityAttribution from "@/components/PerplexityAttribution";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/invoices", label: "Invoices", icon: Receipt },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className="w-56 flex flex-col flex-shrink-0 overflow-y-auto"
        style={{ background: "hsl(var(--sidebar-background))", borderRight: "1px solid hsl(var(--sidebar-border))" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5">
          <SahraLogo />
          <span className="font-semibold text-sm tracking-wide" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>
            Sahra
          </span>
        </div>

        <div className="px-3 mb-2">
          <p className="text-xs font-medium uppercase tracking-wider px-1 mb-2" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.5 }}>
            Platform
          </p>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a className={`sidebar-nav-link ${active ? "active" : ""}`} data-testid={`nav-${label.toLowerCase()}`}>
                  <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                  {label}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: "hsl(var(--sidebar-foreground))", opacity: 0.5 }}>
            <Zap size={12} />
            <span>Solar Billing Engine</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between h-14 px-6 border-b bg-card" style={{ borderColor: "hsl(var(--border))" }}>
          {/* Breadcrumb */}
          <Breadcrumb location={location} />

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} data-testid="theme-toggle" className="h-8 w-8">
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
          <div className="mt-12 pt-4 border-t" style={{ borderColor: "hsl(var(--border))" }}>
            <PerplexityAttribution />
          </div>
        </main>
      </div>
    </div>
  );
}

function Breadcrumb({ location }: { location: string }) {
  const parts = location.split("/").filter(Boolean);
  if (parts.length === 0) return <span className="text-sm font-medium">Dashboard</span>;

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Link href="/"><a className="text-muted-foreground hover:text-foreground transition-colors">Home</a></Link>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight size={13} className="text-muted-foreground" />
          <span className={i === parts.length - 1 ? "font-medium text-foreground" : "text-muted-foreground capitalize"}>
            {isNaN(Number(part)) ? part.replace(/-/g, " ") : `#${part}`}
          </span>
        </span>
      ))}
    </div>
  );
}

function SahraLogo() {
  return (
    <svg
      width="28" height="28" viewBox="0 0 28 28" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-label="Sahra logo"
    >
      {/* Sun circle */}
      <circle cx="14" cy="10" r="5" fill="hsl(38 88% 52%)" />
      {/* Desert dune arc */}
      <path d="M3 22 Q8 15 14 17 Q20 15 25 22 Z" fill="hsl(38 88% 52%)" opacity="0.35" />
      <path d="M3 22 Q9 17 14 19 Q19 17 25 22" stroke="hsl(38 88% 52%)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Sun rays */}
      <line x1="14" y1="2" x2="14" y2="4" stroke="hsl(38 88% 52%)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="4" x2="19" y2="5.5" stroke="hsl(38 88% 52%)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="4" x2="9" y2="5.5" stroke="hsl(38 88% 52%)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
