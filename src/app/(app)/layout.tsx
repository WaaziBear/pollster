import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { logoutAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BarChart3, LogOut, Plus } from "lucide-react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md text-lg font-semibold font-heading tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
            Pollster
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button asChild size="sm" variant="cta">
              <Link href="/polls/new">
                <Plus className="h-4 w-4" /> New poll
              </Link>
            </Button>
            <span
              className="hidden text-sm text-muted-foreground sm:inline"
              title={user.email}
            >
              {user.email}
            </span>
            <ThemeToggle />
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="h-4 w-4" /> Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
