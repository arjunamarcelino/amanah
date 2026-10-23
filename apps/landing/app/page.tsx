import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/sections/hero";
import { Impact } from "@/components/sections/impact";
import { Problem } from "@/components/sections/problem";
import { Causes } from "@/components/sections/causes";
import { Features } from "@/components/sections/features";
import { WhyWeb3 } from "@/components/sections/why-web3";
import { Comparison } from "@/components/sections/comparison";
import { Compliance } from "@/components/sections/compliance";
import { Footer } from "@/components/sections/footer";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Impact />
        <Problem />
        <Causes />
        <Features />
        <WhyWeb3 />
        <Comparison />
        <Compliance />
      </main>
      <Footer />
    </>
  );
}
