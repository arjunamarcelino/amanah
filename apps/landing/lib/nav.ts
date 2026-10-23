import { siteConfig } from "@/lib/site";

/**
 * Header navigation model. The three mega-menus (Donate / Fundraise / About) mirror the
 * GoFundMe header shape but with Amanah-specific content. Per the "App + landing anchors"
 * decision, action items point at the dApp (`external: true`) while informational items
 * point at landing section anchors ("/#causes" etc.). No dead links.
 */
export type NavItem = {
  label: string;
  /** Optional sub-label shown under the label (Donate/Fundraise panels use these). */
  description?: string;
  href: string;
  /** External = the dApp; rendered as a plain <a> rather than a hash-scroll anchor. */
  external?: boolean;
};

export type MegaMenu = {
  /** The nav trigger label. */
  label: string;
  /** Panel heading beside the icon. */
  heading: string;
  /** Which inline icon to show in the panel header. */
  icon: "donate" | "fundraise" | "about";
  items: NavItem[];
};

const app = siteConfig.appUrl;

export const donateMenu: MegaMenu = {
  label: "Donate",
  heading: "Discover causes and campaigns to support",
  icon: "donate",
  items: [
    {
      label: "Browse Campaigns",
      description: "Find a verified cause to support",
      href: app,
      external: true,
    },
    {
      label: "How Donations Work",
      description: "See exactly where your money goes",
      href: "/#how-it-works",
    },
    {
      label: "Disaster Relief",
      description: "Support urgent relief efforts",
      href: app,
      external: true,
    },
    {
      label: "On-Chain Ledger",
      description: "Verify every donation yourself",
      href: `${app}/ledger`,
      external: true,
    },
  ],
};

export const fundraiseMenu: MegaMenu = {
  label: "Fundraise",
  heading: "Start a campaign, tips, and resources",
  icon: "fundraise",
  items: [
    {
      label: "Start a Campaign",
      description: "Launch a fundraiser on-chain",
      href: app,
      external: true,
    },
    {
      label: "How It Works",
      description: "From your gift to delivery",
      href: "/#how-it-works",
    },
    {
      label: "Supported Causes",
      description: "Disaster, medical, education & more",
      href: "/#causes",
    },
    {
      label: "For Organizations",
      description: "Receive funds transparently",
      href: app,
      external: true,
    },
    {
      label: "Why On-Chain Giving",
      description: "Near-zero fees, full transparency",
      href: "/#why-web3",
    },
    {
      label: "The Problem We Solve",
      description: "Why middlemen lose your money",
      href: "/#problem",
    },
  ],
};

export const aboutMenu: MegaMenu = {
  label: "About",
  heading: "How it works, and more",
  icon: "about",
  // The About panel mirrors GoFundMe's — single-line links, no descriptions.
  items: [
    { label: "How Amanah Works", href: "/#how-it-works" },
    { label: "Compliance & Halal", href: "/#compliance" },
    { label: "Why Web3", href: "/#why-web3" },
    { label: "On-Chain Ledger", href: `${app}/ledger`, external: true },
    { label: "The Problem", href: "/#problem" },
    { label: "Supported Causes", href: "/#causes" },
    { label: "Mint Test Tokens", href: `${app}/mint`, external: true },
    { label: "Launch the App", href: app, external: true },
  ],
};

/** Simple (non-mega) links and actions. */
export const headerLinks = {
  /** Search routes straight into the dApp's campaign browser. */
  search: app,
  /** Dedicated connect-wallet route in the dApp. */
  signIn: `${app}/login`,
  /** Primary CTA. */
  startCampaign: app,
} as const;

export const leftMenus: MegaMenu[] = [donateMenu, fundraiseMenu];
export const rightMenus: MegaMenu[] = [aboutMenu];
