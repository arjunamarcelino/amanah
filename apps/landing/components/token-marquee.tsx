import Image from "next/image";

// Infinite logo marquee of the stablecoins donors can give in. The track holds TWO identical
// halves; the CSS animation (globals.css) slides it left by 50% — exactly one half — so the
// loop is seamless. Edge mask fades logos in/out at the sides. Pauses on hover; holds still
// under prefers-reduced-motion.

type Token = { src: string; alt: string; label: string; width: number; height: number };

const TOKENS: Token[] = [
  { src: "/tokens/usdc.svg", alt: "USD Coin", label: "USDC", width: 96, height: 96 },
  { src: "/tokens/xsgd_logo.webp", alt: "XSGD", label: "XSGD", width: 250, height: 250 },
  { src: "/tokens/idrx-symbol.png", alt: "IDRX", label: "IDRX", width: 568, height: 600 },
];

// Enough repeats that one half already spans a wide viewport.
const HALF = Array.from({ length: 5 }, () => TOKENS).flat();

function TokenPill({ token }: { token: Token }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <Image
        src={token.src}
        alt={token.alt}
        width={token.width}
        height={token.height}
        className="h-8 w-auto"
      />
      <span className="text-base font-medium text-foreground-soft">{token.label}</span>
    </div>
  );
}

export function TokenMarquee() {
  const edgeFade =
    "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)";
  return (
    <div
      aria-label={`Supported stablecoins: ${TOKENS.map((t) => t.label).join(", ")}`}
      role="img"
      className="group relative overflow-hidden"
      style={{ maskImage: edgeFade, WebkitMaskImage: edgeFade }}
    >
      <div className="flex w-max animate-marquee gap-x-12 group-hover:[animation-play-state:paused]">
        {[...HALF, ...HALF].map((token, i) => (
          <TokenPill key={i} token={token} />
        ))}
      </div>
    </div>
  );
}
