/**
 * The Pricing page below the plan cards: the "Compare features across plans" table (one per tab in
 * PLAN_TABS, same plan ids) and the FAQ. Keep the numbers in sync with lib/plans.ts and
 * functions/src/plans.ts (PLAN_LIMITS).
 *
 * A cell is true (included), false (not included) or a short text.
 */
import { CONTACT_EMAIL } from "./contact";
import { PRO_PRICE_RUPEES } from "./plans";

export type Cell = boolean | string;
export type CompareSection = { title: string; rows: { label: string; values: Record<string, Cell> }[] };

export const COMPARE: Record<string, CompareSection[]> = {
  individual: [
    {
      title: "Storage",
      rows: [
        { label: "Private storage", values: { free: "1 GB", pro: "10 GB", family: "Shared pool" } },
        { label: "Largest file", values: { free: "20 MB", pro: "50 MB", family: "50 MB" } },
        { label: "Folders, search, drag & drop", values: { free: true, pro: true, family: true } },
        { label: "ZIP upload, unpacked into folders", values: { free: true, pro: true, family: true } },
        { label: "Free PDF and image tools", values: { free: true, pro: true, family: true } },
      ],
    },
    {
      title: "AI answers",
      rows: [
        { label: "Ask AI about your documents", values: { free: true, pro: true, family: true } },
        { label: "AI questions a day", values: { free: "10", pro: "50", family: "50 per member" } },
        { label: "Files in one question", values: { free: "1", pro: "Up to 20", family: "Up to 20" } },
        { label: "Reminders before documents expire", values: { free: true, pro: true, family: true } },
      ],
    },
    {
      title: "Security and sharing",
      rows: [
        { label: "Secure Vault (end-to-end encrypted)", values: { free: true, pro: true, family: true } },
        { label: "Share files by link or email", values: { free: true, pro: true, family: true } },
        { label: "Family members", values: { free: false, pro: false, family: "Up to 5" } },
        { label: "Emergency access for a trusted person", values: { free: false, pro: false, family: true } },
      ],
    },
    {
      title: "Payment options",
      rows: [
        { label: "Price", values: { free: "₹0", pro: `₹${PRO_PRICE_RUPEES} for 30 days`, family: "Coming soon" } },
        { label: "UPI, cards and netbanking", values: { free: "n/a", pro: true, family: true } },
        { label: "Renews automatically", values: { free: "n/a", pro: false, family: false } },
      ],
    },
  ],
  business: [
    {
      title: "Workspace",
      rows: [
        { label: "Shared team folders", values: { team: true, enterprise: true } },
        { label: "Roles and access control", values: { team: true, enterprise: true } },
        { label: "AI answers across team documents", values: { team: true, enterprise: true } },
        { label: "Central billing", values: { team: true, enterprise: true } },
      ],
    },
    {
      title: "Security and administration",
      rows: [
        { label: "Single sign-on (SSO)", values: { team: false, enterprise: true } },
        { label: "Audit logs and data retention controls", values: { team: false, enterprise: true } },
        { label: "Data stored in India", values: { team: true, enterprise: true } },
        { label: "Dedicated support", values: { team: false, enterprise: true } },
      ],
    },
    {
      title: "Payment options",
      rows: [{ label: "Price", values: { team: "Coming soon", enterprise: "Custom pricing" } }],
    },
  ],
};

export type FaqItem = { q: string; a: string };
export type FaqGroup = { id: string; label: string; items: FaqItem[] };

export const FAQ: FaqGroup[] = [
  {
    id: "plans",
    label: "Plans and usage",
    items: [
      {
        q: "What do I get with VaultDoc Pro?",
        a: "Everything in Free, plus AI answers across up to 20 files at once, 50 AI questions a day, 10 GB of storage with files up to 50 MB, and priority support.",
      },
      {
        q: "Is the Free plan really free?",
        a: "Yes. Free includes 1 GB of private storage, the Secure Vault, sharing, the free PDF and image tools, and 10 AI questions a day about one file at a time. No card needed.",
      },
      {
        q: "What counts as an AI question?",
        a: "Each question you ask, and each summary you create, counts as one, even when it covers several files. The count resets every day at midnight India time.",
      },
      {
        q: "Can VaultDoc read the files in my Secure Vault?",
        a: "No. Vault files are encrypted in your browser before they're uploaded, and only your PIN or recovery key can open them. That's also why AI can't read Vault files.",
      },
    ],
  },
  {
    id: "billing",
    label: "Billing and payments",
    items: [
      {
        q: "How do I pay?",
        a: "With UPI, debit or credit card, or netbanking, through Razorpay. VaultDoc never sees your card or bank details.",
      },
      {
        q: "Does Pro renew automatically?",
        a: `No. ₹${PRO_PRICE_RUPEES} gives you 30 days of Pro, and nothing is charged again. Pay again whenever you like; the new 30 days are added to the end of your current Pro.`,
      },
      {
        q: "Can I get a refund?",
        a: "Payments aren't refundable, but Pro stays active until the end of the period you paid for. If you were charged twice or Pro didn't start, write to us and we'll fix it.",
      },
    ],
  },
  {
    id: "managing",
    label: "Managing your plan",
    items: [
      {
        q: "What happens when Pro ends?",
        a: "Your account goes back to Free. Your files stay where they are, but you can't upload more until you're under the Free storage limit again.",
      },
      {
        q: "Where can I see my plan and payments?",
        a: "In My Space, under your plan summary: it shows when Pro ends and the payments you've made.",
      },
      {
        q: "When are Family and Team plans coming?",
        a: `We're building them now. Write to ${CONTACT_EMAIL} if you'd like early access.`,
      },
    ],
  },
];
