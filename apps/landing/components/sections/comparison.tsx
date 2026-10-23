import type { ReactNode } from "react";
import Image from "next/image";
import { Section } from "@/components/section";
import { Reveal } from "@/components/reveal";
import { Eyebrow } from "@/components/eyebrow";
import { SectionHeading } from "@/components/section-heading";

// Comparison table: Amanah vs. mainstream donation platforms, across the aspects where an
// on-chain router wins — fees that trend to zero, near-instant payout, and a ledger anyone
// can verify. Competitor figures are taken from crowdfunding.com's published platform
// comparison (cited in the footnote) so the numbers trace to a source rather than our claim.
// Amanah's column reflects the protocol design; it is live on Base Sepolia testnet today.

type Cell = { value: ReactNode; win?: boolean };
type Row = { aspect: string; amanah: Cell; others: [Cell, Cell, Cell] };

const PLATFORMS = ["GoFundMe", "Kickstarter", "JustGiving"] as const;

const rows: Row[] = [
  {
    aspect: "Platform fee",
    amanah: { value: "0%", win: true },
    others: [{ value: "0%" }, { value: "5%" }, { value: "0–5%" }],
  },
  {
    aspect: "Processing fee",
    amanah: { value: "Near-zero", win: true },
    others: [{ value: "2.9% + $0.30" }, { value: "3% + $0.20" }, { value: "2.9%" }],
  },
  {
    aspect: "Payout speed",
    amanah: { value: "Minutes", win: true },
    others: [{ value: "2–5 days" }, { value: "14-day wait" }, { value: "6–10 days" }],
  },
  {
    aspect: "Fund transparency",
    amanah: { value: "Every transfer on-chain, publicly verifiable", win: true },
    others: [{ value: "Private ledger" }, { value: "Private ledger" }, { value: "Private ledger" }],
  },
  {
    aspect: "Currencies accepted",
    amanah: { value: "Any stablecoin, borderless", win: true },
    others: [{ value: "Card / fiat" }, { value: "Card / fiat" }, { value: "Card / fiat" }],
  },
  {
    aspect: "Shariah-compliant handling",
    amanah: { value: "Opt-in halal routing", win: true },
    others: [{ value: "—" }, { value: "—" }, { value: "—" }],
  },
];

export function Comparison() {
  return (
    <Section id="comparison" labelledBy="comparison-title" sectionClassName="bg-secondary">
      <Reveal>
        <Eyebrow>How we compare</Eyebrow>

        <SectionHeading id="comparison-title" className="mt-5 max-w-[20ch]">
          More of every gift reaches the cause.
        </SectionHeading>

        <p className="mt-5 max-w-[46rem] text-lg leading-relaxed text-foreground-soft">
          Others skim 3–8%, make you wait days, and hide the ledger. Amanah routes on-chain — fees
          near zero, funds in minutes, every transfer public.
        </p>
      </Reveal>

      <Reveal>
        {/* Scrolls horizontally on narrow screens; the page body never scrolls sideways. */}
        <div className="mt-10 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Amanah compared with GoFundMe, Kickstarter, and JustGiving across fees, payout
              speed, transparency, currencies, and Shariah-compliant handling.
            </caption>
            <thead>
              <tr className="bg-muted/70">
                <th scope="col" className="w-[30%] px-5 py-4 font-medium text-muted-foreground">
                  <span className="sr-only">Comparison aspect</span>
                </th>
                <th scope="col" className="w-[28%] bg-primary px-5 py-4 text-center">
                  <Image
                    src="/amanah-logo.png"
                    alt="Amanah"
                    width={267}
                    height={100}
                    className="mx-auto block h-7 w-auto brightness-0 invert"
                  />
                </th>
                {PLATFORMS.map((name) => (
                  <th
                    key={name}
                    scope="col"
                    className="px-5 py-4 text-center font-medium text-muted-foreground"
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.aspect}
                  className={`group transition-colors hover:bg-muted/60 ${
                    i % 2 === 1 ? "bg-muted/35" : ""
                  }`}
                >
                  <th scope="row" className="px-5 py-4 align-top font-medium text-foreground">
                    <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                      {row.aspect}
                    </span>
                  </th>
                  <td className="bg-accent/40 px-5 py-4 text-center align-top transition-colors group-hover:bg-accent/70">
                    <span className="inline-flex items-start justify-center gap-1.5 font-medium text-primary">
                      {row.amanah.win ? <CheckIcon /> : null}
                      <span>{row.amanah.value}</span>
                    </span>
                  </td>
                  {row.others.map((cell, j) => (
                    <td key={j} className="px-5 py-4 text-center align-top text-muted-foreground">
                      {cell.value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Reveal>
        <p className="mt-4 text-xs text-muted-foreground">
          Competitor figures via{" "}
        <a
          href="https://www.crowdfunding.com/"
          rel="nofollow noopener"
          className="underline underline-offset-2 hover:no-underline"
        >
          crowdfunding.com
        </a>{" "}
          platform comparison; fees and timelines may change. Amanah is live on Base Sepolia
          testnet — figures reflect the protocol design during early access.
        </p>
      </Reveal>
    </Section>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="mt-0.5 size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
