import type { SVGProps } from 'react';

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" {...props}>{children}</svg>;
}

export const SmokeIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M5 16h11a3 3 0 0 0 0-6 5 5 0 0 0-9.4-1.8A4 4 0 0 0 5 16Z"/><path d="M7 19h10M10 22h6"/></Icon>;
export const DashIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M4 7h9M2 12h10M5 17h8"/><path d="m13 5 7 7-7 7"/></Icon>;
export const RelicIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="m12 3 6 4v8l-6 6-6-6V7l6-4Z"/><path d="m6 7 6 4 6-4M12 11v10"/></Icon>;
export const HeartIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M20 8.5c0 5-8 10-8 10s-8-5-8-10A4.5 4.5 0 0 1 12 5a4.5 4.5 0 0 1 8 3.5Z"/></Icon>;
export const ArrowIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="m9 5 7 7-7 7"/></Icon>;
export const ExitIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M5 21V4h14v17M8 21V7h8v14"/><path d="m10 11 3 3-3 3M13 14H6"/></Icon>;
export const LockIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><rect x="5" y="10" width="14" height="11"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></Icon>;
export const WallIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M3 5h18v14H3zM3 10h18M3 15h18M8 5v5m8-5v5m-5 0v5m7 0v4M6 15v4"/></Icon>;
export const SpikeIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="m3 19 3-9 3 9 3-13 3 13 3-9 3 9H3Z"/></Icon>;
export const RuneIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="m12 3 8 9-8 9-8-9 8-9Z"/><path d="m12 7 4 5-4 5-4-5 4-5Z"/></Icon>;
export const GuardIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M5 10V6l7-3 7 3v4c0 5-3 9-7 11-4-2-7-6-7-11Z"/><path d="M9 11h6M10 8h.01M14 8h.01"/></Icon>;
export const EraseIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="m4 15 9-10 7 6-7 8H8l-4-4Z"/><path d="m10 9 7 6M13 19h8"/></Icon>;
export const ArchiveIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M4 5h16v4H4zM6 9h12v11H6zM9 13h6"/></Icon>;
export const RankIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H3v2a4 4 0 0 0 5 4M17 6h4v2a4 4 0 0 1-5 4"/></Icon>;
export const CloseIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="m5 5 14 14M19 5 5 19"/></Icon>;
