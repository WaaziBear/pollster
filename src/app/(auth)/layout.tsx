import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md text-lg font-semibold font-heading tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
            Pollster
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="container flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
