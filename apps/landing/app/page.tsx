import { Wordmark } from "@/components/wordmark";
import { Hero } from "@/components/sections/hero";
import { Problem } from "@/components/sections/problem";
import { Causes } from "@/components/sections/causes";
import { Features } from "@/components/sections/features";
import { WhyWeb3 } from "@/components/sections/why-web3";
import { Compliance } from "@/components/sections/compliance";
import { Footer } from "@/components/sections/footer";

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[69rem] items-center px-[clamp(1.25rem,5vw,3rem)]">
          <Wordmark />
        </div>
      </header>
      <main>
        <Hero />
        <Problem />
        <Causes />
        <Features />
        <WhyWeb3 />
        <Compliance />
      </main>
      <Footer />
    </>
  );
}
