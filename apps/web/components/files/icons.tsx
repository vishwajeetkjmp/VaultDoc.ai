import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function make(paths: React.ReactNode) {
  return function Icon({ size = 20, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const PlusIcon = make(<path d="M12 5v14M5 12h14" />);
export const SearchIcon = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const MoreIcon = make(<><circle cx="12" cy="5" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="19" r="1.2" fill="currentColor" /></>);
export const FolderIcon = make(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />);
export const FolderPlusIcon = make(<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 11v5M9.5 13.5h5" /></>);
export const UploadIcon = make(<><path d="M12 15V4M7 9l5-5 5 5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>);
export const DownloadIcon = make(<><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 18h16" /></>);
export const OpenIcon = make(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" /></>);
export const PencilIcon = make(<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />);
export const TrashIcon = make(<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></>);
export const CheckIcon = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const AlertIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></>);
export const CloseIcon = make(<path d="M6 6l12 12M18 6 6 18" />);
export const ChevronDownIcon = make(<path d="m6 9 6 6 6-6" />);
export const ChevronUpIcon = make(<path d="m6 15 6-6 6 6" />);
export const ChevronRightIcon = make(<path d="m9 6 6 6-6 6" />);
export const ArrowUpIcon = make(<path d="M12 19V5M6 11l6-6 6 6" />);
export const ArrowDownIcon = make(<path d="M12 5v14M6 13l6 6 6-6" />);
export const CloudIcon = make(<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5z" />);
export const HomeIcon = make(<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />);
export const SkipIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></>);
export const ShareIcon = make(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M17 8v6M14 11h6" /></>);
export const PeopleIcon = make(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.2a5.5 5.5 0 0 1 3 4.8" /></>);
export const LinkIcon = make(<><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></>);
export const GlobeIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>);
export const LockIcon = make(<><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>);
export const ClockIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const EyeIcon = make(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>);
export const InboxIcon = make(<><path d="M4 13h4l2 3h4l2-3h4" /><path d="M5.5 5h13l1.5 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5z" /></>);
export const ZipIcon = make(<><path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M10 3v2h2v2h-2v2h2v2h-2v2" /></>);
