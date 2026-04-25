import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarPanel } from "@/domains/account/ui/account-sidebar-panel";
import { MobileNav } from "@/domains/account/ui/account-mobile-nav";
import { StudioOverview } from "@/domains/account/ui/account-overview";
import { OrdersSection } from "@/domains/account/ui/account-orders-section";
import { UserPreferences } from "@/domains/account/ui/account-user-preferences";
import { SubscriptionManagement } from "@/domains/account/ui/subscription-management";
import { UsageDashboard } from "@/domains/account/ui/usage-dashboard";
import { ProfileEditor } from "@/domains/account/ui/profile-editor";
import type { Section } from "@/domains/account/model";

// ─── Section metadata ─────────────────────────────────────────────────────────

const SECTION_META: Record<Section, { title: string; desc: string }> = {
  overview: { title: "Overview", desc: "" },
  subscription: {
    title: "Subscription",
    desc: "Your current plan and billing",
  },
  usage: { title: "Usage", desc: "Generation history and limits" },
  orders: { title: "Orders", desc: "Purchase history" },
  preferences: { title: "Preferences", desc: "Customize your AI defaults" },
  profile: { title: "Profile", desc: "Account information" },
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function AccountInteractive() {
  const [activeSection, setActiveSection] = useState<Section>("overview");

  const meta = SECTION_META[activeSection];

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <SidebarPanel
        activeSection={activeSection}
        onNavigate={setActiveSection}
      />

      {/* Right panel */}
      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Mobile nav */}
        <MobileNav
          activeSection={activeSection}
          onNavigate={setActiveSection}
        />

        {/* Section header (desktop only, overview skips it) */}
        {activeSection !== "overview" && (
          <div className="hidden md:block px-8 pt-7 pb-0">
            <h2 className="text-base font-semibold text-foreground">
              {meta.title}
            </h2>
            {meta.desc && (
              <p className="text-xs text-dim-2 mt-0.5">{meta.desc}</p>
            )}
            <div className="mt-5 h-px bg-border" />
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex-1 p-5 md:px-8 md:py-7"
          >
            {activeSection === "overview" && (
              <StudioOverview onNavigate={setActiveSection} />
            )}
            {activeSection === "subscription" && <SubscriptionManagement />}
            {activeSection === "usage" && <UsageDashboard />}
            {activeSection === "orders" && <OrdersSection />}
            {activeSection === "preferences" && <UserPreferences />}
            {activeSection === "profile" && <ProfileEditor />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
