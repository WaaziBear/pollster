"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dependency-free dark-mode toggle. Flips the `dark` class on <html> and
 * persists the choice in localStorage. The initial class is applied by the
 * pre-hydration script in the root layout, so there is no theme flash; this
 * control only reflects and updates that state. Visual/theming only — no app
 * behavior, routing, or data is affected.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore storage failures (private mode, etc.) */
    }
    setIsDark(next);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className={className}
    >
      {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
      <span className="sr-only">Toggle color theme</span>
    </Button>
  );
}
