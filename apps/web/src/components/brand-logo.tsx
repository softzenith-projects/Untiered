import Image from "next/image";

/**
 * The supplied raster wordmarks have light and dark surface variants.
 *
 * On dark surfaces the "U" is drawn from `wordmark-on-navy.png`, not the supplied dark
 * variant: its gradient bottoms out in an indigo at 1.2:1 against our navy, so the letter
 * vanished into the hero and the sign-in panel. The on-navy file is the same artwork with
 * only the U's pixels lifted toward white, each just far enough to reach 3:1 (the WCAG
 * minimum for graphics) while keeping its hue. The supplied files are unchanged.
 */
export function BrandWordmark({ inverse = false }: { inverse?: boolean }) {
  if (inverse) {
    return (
      <Image
        src="/brand/wordmark-on-navy.png"
        alt="Untiered"
        width={378}
        height={82}
        className="h-auto w-[9.5rem] sm:w-[10.5rem]"
      />
    );
  }

  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet="/brand/wordmark-on-navy.png" />
      <Image
        src="/brand/wordmark-light.png"
        alt="Untiered"
        width={378}
        height={82}
        className="h-auto w-[9.5rem] sm:w-[10.5rem]"
      />
    </picture>
  );
}

export function BrandMark() {
  return (
    <Image
      src="/brand/mark.png"
      alt="Untiered"
      width={69}
      height={82}
      className="h-8 w-auto"
    />
  );
}
