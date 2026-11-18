import { cn } from "@/lib/cn";

type Tone = "accent" | "positive" | "highlight" | "navy" | "neutral" | "danger" | "info";

export function Badge({
  tone = "accent",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn("pill", `pill-${tone}`, className)}>{children}</span>;
}
