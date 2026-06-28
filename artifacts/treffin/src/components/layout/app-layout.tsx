import React from "react";
import { SidebarLeft } from "./sidebar-left";
import { SidebarRight } from "./sidebar-right";
import { TopNavbar } from "./top-navbar";
import { BottomNav } from "./bottom-nav";
import { Footer } from "./footer";

export function AppLayout({
  children,
  rightSidebar,
}: {
  children: React.ReactNode;
  rightSidebar?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TopNavbar />
      <div className="flex flex-1 max-w-[1400px] mx-auto w-full px-4 gap-6 pt-6">

        {/* Left sidebar — sticky with internal scroll */}
        <aside className="hidden md:block w-[240px] shrink-0">
          <div className="sticky top-[68px] overflow-y-auto" style={{ maxHeight: "calc(100vh - 68px)", scrollbarWidth: "none" }}>
            <SidebarLeft />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-24 md:pb-20">
          {children}
        </main>

        {/* Right sidebar — sticky with internal scroll */}
        <aside className="hidden lg:block w-[320px] shrink-0">
          <div className="sticky top-[68px] overflow-y-auto" style={{ maxHeight: "calc(100vh - 68px)", scrollbarWidth: "none" }}>
            {rightSidebar ?? <SidebarRight />}
          </div>
        </aside>
      </div>

      {/* Full-width footer — appears when scrolled to bottom */}
      <Footer />

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
