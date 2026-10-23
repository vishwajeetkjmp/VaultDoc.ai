/**
 * Everything shown on the Pricing page. Edit names, prices and features here;
 * the page layout picks them up automatically.
 *
 * price: null           → shows "Coming soon" and a disabled button
 * price: { monthly: 0 } → free plan
 * price: { monthly, yearly } → paid plan; when any plan in a tab has a yearly
 *                         price, a Monthly / Yearly switch appears for that tab
 * (Amounts are in rupees. yearly is the total charged per year.)
 */
export type PlanIcon = "seed" | "sprout" | "family" | "team" | "building";

export type Plan = {
  id: string;
  name: string;
  badge?: string;
  tagline: string;
  icon: PlanIcon;
  price: { monthly: number; yearly?: number } | null;
  /** Shown under ₹0 or instead of the billing note */
  priceNote?: string;
  cta: { label: string; href?: string };
  /** Heading above the feature list, e.g. "Everything in Free, plus:" */
  featuresTitle?: string;
  features: string[];
  highlighted?: boolean;
};

export type PlanTab = { id: string; label: string; plans: Plan[] };

export const PLAN_TABS: PlanTab[] = [
  {
    id: "individual",
    label: "Individual",
    plans: [
      {
        id: "free",
        name: "Free",
        tagline: "Try VaultDoc",
        icon: "seed",
        price: { monthly: 0 },
        priceNote: "Free for everyone",
        cta: { label: "Get started free", href: "/signup" },
        featuresTitle: "Includes:",
        features: [
          "1 GB of private storage",
          "Files up to 20 MB each",
          "Folders, search, drag & drop upload",
          "ZIP upload, unpacked into folders",
          "Secure Vault with end-to-end encryption",
          "Works on phone and desktop",
        ],
      },
      {
        id: "pro",
        name: "Pro",
        badge: "AI included",
        tagline: "For everyday paperwork",
        icon: "sprout",
        price: null, // set e.g. { monthly: 199, yearly: 1990 } when ready
        cta: { label: "Coming soon" },
        featuresTitle: "Everything in Free, plus:",
        features: [
          "Ask questions about your documents with AI",
          "More storage and bigger files",
          "Reminders before documents expire",
          "Priority support",
        ],
        highlighted: true,
      },
      {
        id: "family",
        name: "Family",
        badge: "AI included",
        tagline: "One vault for the whole household",
        icon: "family",
        price: null,
        cta: { label: "Coming soon" },
        featuresTitle: "Everything in Pro, plus:",
        features: [
          "Up to 5 family members",
          "Shared folders for household papers",
          "Emergency access for a trusted person",
          "Shared storage pool",
        ],
      },
    ],
  },
  {
    id: "business",
    label: "Business",
    plans: [
      {
        id: "team",
        name: "Team",
        tagline: "For small offices and firms",
        icon: "team",
        price: null,
        priceNote: "Per member, per month",
        cta: { label: "Coming soon" },
        featuresTitle: "Includes:",
        features: [
          "Shared team folders",
          "Roles and access control",
          "AI answers across team documents",
          "Central billing",
        ],
      },
      {
        id: "enterprise",
        name: "Enterprise",
        tagline: "For larger organisations",
        icon: "building",
        price: null,
        priceNote: "Custom pricing",
        cta: { label: "Coming soon" },
        featuresTitle: "Everything in Team, plus:",
        features: [
          "Single sign-on (SSO)",
          "Audit logs and data retention controls",
          "Dedicated support",
          "Data residency in India",
        ],
      },
    ],
  },
];

export function formatRupees(amount: number) {
  return "₹" + amount.toLocaleString("en-IN");
}
