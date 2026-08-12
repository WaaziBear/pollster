import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BarChart3, Mail, ListChecks } from "lucide-react";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <span className="flex items-center gap-2 text-lg font-semibold font-heading tracking-tight">
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
            Pollster
          </span>
          <nav className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="container flex flex-1 flex-col items-center justify-center py-20 text-center">
        <h1 className="max-w-2xl text-4xl font-bold font-heading tracking-tight sm:text-5xl">
          Create polls, invite by email, see the results.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Build polls with single-choice, multiple-choice, free-text, and rating
          questions. Share privately with invited people and view live aggregates.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" variant="cta">
            <Link href="/signup">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">I have an account</Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <Feature icon={<ListChecks />} title="Varied questions">
            Radio, checkbox, short answer, and rating — extensible by design.
          </Feature>
          <Feature icon={<Mail />} title="Private by invite">
            Only invited emails can view and answer each poll.
          </Feature>
          <Feature icon={<BarChart3 />} title="Live results">
            Creators see counts, averages, and raw text responses.
          </Feature>
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-card/50 p-6 text-center transition-shadow hover:shadow-md">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </div>
      <h3 className="font-semibold font-heading">{title}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
