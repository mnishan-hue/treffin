import { type ReactNode } from "react";
import { MathBottomNav } from "./math-bottom-nav";

interface MathLayoutProps {
  children: ReactNode;
}

export function MathLayout({ children }: MathLayoutProps) {
  return (
    <>
      <div style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 62px)" }} className="lg:pb-0">
        {children}
      </div>
      <MathBottomNav />
    </>
  );
}
