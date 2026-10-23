import type { PlanIcon as IconName } from "../../lib/plans";

/** Simple line drawings that grow with the plan; the accent colour marks what each level adds. */
export default function PlanIcon({ name }: { name: IconName }) {
  const common = {
    width: 84,
    height: 84,
    viewBox: "0 0 84 84",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  const accent = { fill: "var(--primary)", stroke: "var(--primary)" };

  switch (name) {
    case "seed": // a closed padlock
      return (
        <svg {...common}>
          <rect x="22" y="38" width="40" height="32" rx="7" />
          <path d="M30 38v-9a12 12 0 0 1 24 0v9" />
          <circle cx="42" cy="53" r="4" {...accent} />
        </svg>
      );
    case "sprout": // padlock with AI sparkles
      return (
        <svg {...common}>
          <rect x="16" y="40" width="40" height="32" rx="7" />
          <path d="M24 40v-9a12 12 0 0 1 24 0v9" />
          <circle cx="36" cy="55" r="4" />
          <path d="M64 10v12M58 16h12" {...accent} />
          <path d="M70 30v8M66 34h8" {...accent} />
        </svg>
      );
    case "family": // three people above a shared lock
      return (
        <svg {...common}>
          <circle cx="20" cy="26" r="7" />
          <circle cx="64" cy="26" r="7" />
          <circle cx="42" cy="18" r="7" {...accent} />
          <path d="M8 52c2-8 7-12 12-12s10 4 12 12M52 52c2-8 7-12 12-12s10 4 12 12M30 42c2-8 7-12 12-12s10 4 12 12" />
          <rect x="30" y="56" width="24" height="18" rx="5" />
          <path d="M35 56v-4a7 7 0 0 1 14 0v4" />
        </svg>
      );
    case "team": // two people and a shared folder
      return (
        <svg {...common}>
          <circle cx="28" cy="22" r="8" />
          <circle cx="56" cy="22" r="8" {...accent} />
          <path d="M14 46c2-9 8-14 14-14s12 5 14 14M42 46c2-9 8-14 14-14s12 5 14 14" />
          <path d="M18 58a4 4 0 0 1 4-4h12l4 5h24a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" />
        </svg>
      );
    case "building": // an office building
      return (
        <svg {...common}>
          <rect x="18" y="14" width="34" height="58" rx="3" />
          <path d="M52 34h14v38H52" />
          <path d="M27 24h6M37 24h6M27 34h6M37 34h6M27 44h6M37 44h6" />
          <rect x="30" y="56" width="10" height="16" {...accent} />
          <path d="M58 44h3M58 54h3" {...accent} />
        </svg>
      );
  }
}
