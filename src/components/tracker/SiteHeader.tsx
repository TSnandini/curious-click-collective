import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/submit", label: "Report" },
  { to: "/track", label: "My reports" },
  { to: "/handler", label: "Handlers" },
  { to: "/routing", label: "Routing" },
  { to: "/analytics", label: "Analytics" },
  { to: "/tests", label: "Test lab" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-ink text-ink-foreground">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="grid size-8 place-items-center rounded bg-primary text-primary-foreground">
            <UtensilsCrossed className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold">Kitchen Ticket</span>
          <span className="hidden font-mono text-[10px] tracking-widest text-ink-foreground/60 sm:inline">COMPLAINT TRACKER</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded px-3 py-1.5 text-sm text-ink-foreground/75 transition-colors hover:bg-ink-foreground/10 hover:text-ink-foreground"
              activeProps={{ className: "bg-ink-foreground/10 !text-ink-foreground" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <button className="rounded p-2 lg:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      <nav className={cn("border-t border-ink-foreground/10 px-4 pb-3 lg:hidden", open ? "block" : "hidden")}>
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            onClick={() => setOpen(false)}
            className="block rounded px-3 py-2 text-sm text-ink-foreground/80"
            activeProps={{ className: "bg-ink-foreground/10 !text-ink-foreground" }}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
