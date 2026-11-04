import Image from "next/image";

/**
 * The supplied raster wordmarks have light and dark surface variants.
 *
 * On navy (`inverse`) the wordmark sits on a white chip rather than straight on the
 * background: the "U" gradient ends in an indigo that is nearly the navy itself, so drawn
 * directly it disappeared. The owner chose the chip over recolouring the artwork
 * (28 October 2026) — the logo is always the supplied file, unaltered.
 */
export function BrandWordmark({ inverse = false }: { inverse?: boolean }) {
  if (inverse) {
    return (
      <span className="inline-flex rounded-xl bg-on-navy px-3.5 py-2.5 shadow-[var(--shadow-md)]">
        <Image
          src="/brand/wordmark-light.png"
          alt="Untiered"
          width={378}
          height={82}
          className="h-auto w-[9.5rem] sm:w-[10.5rem]"
        />
      </span>
    );
  }

  // In dark mode the supplied dark-surface wordmark loses its "U" against the page, the
  // same failure as on navy. So dark mode uses the white chip too (owner, 4 November 2026).
  return (
    <>
      <Image
        src="/brand/wordmark-light.png"
        alt="Untiered"
        width={378}
        height={82}
        className="h-auto w-[9.5rem] dark:hidden sm:w-[10.5rem]"
      />
      <span className="hidden rounded-xl bg-on-navy px-3 py-1.5 shadow-[var(--shadow-sm)] dark:inline-flex">
        <Image
          src="/brand/wordmark-light.png"
          alt="Untiered"
          width={378}
          height={82}
          className="h-auto w-[8.5rem] sm:w-[9.5rem]"
        />
      </span>
    </>
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
