import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function SurfaceHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("hero-band px-6 py-8 sm:px-10 sm:py-10", className)}>
      {eyebrow ? <p className="pill pill-navy w-fit">{eyebrow}</p> : null}
      <h1 className="mt-4 text-display text-balance text-on-navy">{title}</h1>
      {description ? <p className="mt-3 max-w-2xl text-body text-on-navy-muted">{description}</p> : null}
      {children}
    </header>
  );
}
