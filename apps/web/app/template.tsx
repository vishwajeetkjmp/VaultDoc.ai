/** Wraps every page so it fades in on navigation instead of popping in. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
