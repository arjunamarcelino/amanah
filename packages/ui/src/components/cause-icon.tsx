import type { SVGProps } from "react";

// Original scalable line icons (shared viewBox 0 0 24 24, 1.75 stroke, rounded caps/joins,
// no fill). Keys match the CampaignType enum exactly. stroke is currentColor so the icon
// inherits the adjacent badge/text color — see README in the source asset drop.
const paths = {
  "disaster": [
    "M4 11 12 4l8 7",
    "M6 10v6m12-6v6",
    "M10 15v-3h4v3",
    "M3 17c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0",
    "M3 21c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0"
  ],
  "education": [
    "M12 6C9 4 6 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z",
    "M12 6v14",
    "M6 9c1-.2 2 0 3 .5m6 0c1-.5 2-.7 3-.5"
  ],
  "medical": [
    "M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"
  ],
  "poverty": [
    "M3 12h18c0 4.5-3.5 8-9 8s-9-3.5-9-8Z",
    "M8 22h8",
    "M8 8c-2-2 2-3 0-5m4 5c-2-2 2-3 0-5m4 5c-2-2 2-3 0-5"
  ],
  "waqf": [
    "M6 12c0-3 4-4 6-7 2 3 6 4 6 7Z",
    "M5 12h14v9H5Z",
    "M10 21v-4a2 2 0 0 1 4 0v4",
    "M12 5V3",
    "M3 21h18"
  ],
  "general": [
    "M20.8 5.5a5 5 0 0 0-7.1 0L12 7.2l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.4a5 5 0 0 0 0-7.1Z"
  ]
} as const;

export type Cause = keyof typeof paths;
export type CauseIconProps = SVGProps<SVGSVGElement> & { cause: Cause };

/** Decorative by default; pass aria-label for a standalone accessible icon. */
export function CauseIcon({ cause, ...props }: CauseIconProps) {
  const labeled = Boolean(props["aria-label"] || props["aria-labelledby"]);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={labeled ? undefined : true}
      role={labeled ? "img" : undefined}
      {...props}
    >
      {/* Fallback to `general` if an out-of-catalog cause ever reaches this shared
          component, so a vocabulary mismatch degrades to a heart icon, not a crash. */}
      {(paths[cause] ?? paths.general).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
