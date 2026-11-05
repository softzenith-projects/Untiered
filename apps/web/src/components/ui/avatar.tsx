import Image from "next/image";

import { cn } from "@/lib/cn";

export function Avatar({
  src,
  alt,
  fallback,
  className,
}: {
  src?: string | null;
  alt: string;
  fallback: string;
  className?: string;
}) {
  return src ? (
    <Image src={src} alt={alt} width={80} height={80} loading="lazy" unoptimized referrerPolicy="no-referrer" className={cn("size-20 rounded-xl object-cover", className)} />
  ) : (
    <span role="img" aria-label={alt} className={cn("grid size-20 place-items-center rounded-xl bg-avatar-fill text-title font-bold text-avatar-ink", className)}>{fallback}</span>
  );
}
