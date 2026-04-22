/**
 * SKU Analysis Dashboard — Main Page
 * Design: Refined Analytical Dashboard
 * - Warm off-white background, Sora headings + Inter body
 * - Amber accent for new SKUs, slate sidebar
 * - Fixed left sidebar, tabbed main content
 */

import { useState } from "react";
import { skuData } from "@/lib/skuData";
import SummaryCards from "@/components/dashboard/SummaryCards";
import CategoryTab from "@/components/dashboard/CategoryTab";
import StylesTab from "@/components/dashboard/StylesTab";
import LeathersTab from "@/components/dashboard/LeathersTab";
import ColoursTab from "@/components/dashboard/ColoursTab";
import ExpansionTab from "@/components/dashboard/ExpansionTab";
import ColourLeatherTab from "@/components/dashboard/ColourLeatherTab";
import ExportPanel from "@/components/dashboard/ExportPanel";
import BuySessionsPanel from "@/components/dashboard/BuySessionsPanel";
import BuyAnalysisTab from "@/components/dashboard/BuyAnalysisTab";
import LastApprovalTab from "@/components/dashboard/LastApprovalTab";
import { FittingTab } from "@/components/dashboard/FittingTab";
import SeasonAnalysisTab from "@/components/dashboard/SeasonAnalysisTab";
import SpecsTab from "@/components/dashboard/SpecsTab";
import {
  LayoutDashboard,
  Tag,
  Table2,
  Layers,
  Palette,
  TrendingUp,
  ChevronRight,
  Combine,
  Download,
  ShoppingCart,
  BarChart3,
  Stamp,
  LineChart,
  Ruler,
  ClipboardList,
} from "lucide-react";

type Tab = "overview" | "categories" | "styles" | "leathers" | "colours" | "colourleather" | "expansion" | "buy-sessions" | "buy-analysis" | "last-approval" | "fitting" | "specs" | "season-analysis";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NAV_ITEMS: { id: Tab; label: string; icon: React.ComponentType<any>; group?: string }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "categories", label: "By Category", icon: Tag },
  { id: "styles", label: "By Style", icon: Table2 },
  { id: "leathers", label: "Leathers", icon: Layers },
  { id: "colours", label: "Colours", icon: Palette },
  { id: "colourleather", label: "Colour/Leather", icon: Combine },
  { id: "expansion", label: "Expansion Analysis", icon: TrendingUp },
  { id: "buy-sessions", label: "Buy Sessions", icon: ShoppingCart, group: "buying" },
  { id: "buy-analysis", label: "Buy Analysis", icon: BarChart3, group: "buying" },
  { id: "last-approval", label: "Last Approval", icon: Stamp, group: "approval" },
  { id: "fitting", label: "Fitting", icon: Ruler, group: "approval" },
  { id: "specs", label: "Specs", icon: ClipboardList, group: "approval" },
  { id: "season-analysis", label: "Season Analysis", icon: LineChart, group: "analysis" },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showExport, setShowExport] = useState(false);

  const tabLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <aside className="w-60 flex-shrink-0 flex flex-col h-full overflow-y-auto"
        style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}>
        {/* Logo area */}
        <div className="px-5 py-6 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
          <h1 className="font-display font-bold text-lg leading-tight" style={{ color: "var(--sidebar-foreground)" }}>
            SKU Analysis
          </h1>
          <p className="text-xs mt-1 font-medium" style={{ color: "oklch(0.60 0.01 80)" }}>
            SS26 Range Review
          </p>
        </div>

        {/* Quick stats */}
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
          <div className="space-y-2">
            <StatRow label="Total SKUs" value={skuData.summary.totalSKUs.toLocaleString()} />
            <StatRow
              label="New SKUs"
              value={skuData.summary.newSKUs.toLocaleString()}
              highlight
            />
            <StatRow label="Total Styles" value={skuData.summary.totalStyles.toLocaleString()} />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.50 0.01 80)" }}>
            Sections
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter((i) => !i.group).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150"
                    style={{
                      background: isActive ? "var(--sidebar-accent)" : "transparent",
                      color: isActive ? "var(--sidebar-primary)" : "var(--sidebar-foreground)",
                    }}
                  >
                    <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center"><Icon className="w-4 h-4" /></span>
                    <span>{item.label}</span>
                    {isActive && (
                      <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-2 mt-4 mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.50 0.01 80)" }}>
            Buying
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter((i) => i.group === "buying").map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150"
                    style={{
                      background: isActive ? "var(--sidebar-accent)" : "transparent",
                      color: isActive ? "var(--sidebar-primary)" : "var(--sidebar-foreground)",
                    }}
                  >
                    <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center"><Icon className="w-4 h-4" /></span>
                    <span>{item.label}</span>
                    {isActive && (
                      <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-2 mt-4 mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.50 0.01 80)" }}>
            Approval
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter((i) => i.group === "approval").map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150"
                    style={{
                      background: isActive ? "var(--sidebar-accent)" : "transparent",
                      color: isActive ? "var(--sidebar-primary)" : "var(--sidebar-foreground)",
                    }}
                  >
                    <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center"><Icon className="w-4 h-4" /></span>
                    <span>{item.label}</span>
                    {isActive && (
                      <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-2 mt-4 mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.50 0.01 80)" }}>
            Analysis
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter((i) => i.group === "analysis").map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150"
                    style={{
                      background: isActive ? "var(--sidebar-accent)" : "transparent",
                      color: isActive ? "var(--sidebar-primary)" : "var(--sidebar-foreground)",
                    }}
                  >
                    <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center"><Icon className="w-4 h-4" /></span>
                    <span>{item.label}</span>
                    {isActive && (
                      <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs" style={{ color: "oklch(0.55 0.01 80)" }}>
              Data loaded
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 80)" }}>
            {skuData.summary.totalStyles} styles · {skuData.summary.uniqueLeathers} leathers · {skuData.summary.uniqueColours} colours
          </p>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 px-8 py-4 border-b bg-card flex items-center justify-between"
          style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="font-display font-semibold text-xl text-foreground">{tabLabel}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeTab === "overview" && `${skuData.summary.newSKUs} new SKUs across ${skuData.summary.stylesWithNew} styles`}
              {activeTab === "categories" && `${skuData.categories.length} categories`}
              {activeTab === "styles" && `${skuData.styles.length} styles — click a style to expand SKUs`}
              {activeTab === "leathers" && `${skuData.leathers.length} unique leather types`}
              {activeTab === "colours" && `${skuData.colours.length} unique colours`}
              {activeTab === "colourleather" && "Colour/leather combinations"}
              {activeTab === "expansion" && "New SKU coverage analysis"}
              {activeTab === "buy-sessions" && "Manage weekly buy rounds — create, lock, and export independently"}
              {activeTab === "buy-analysis" && "Breakdown of pairs bought per session by category, leather, and colour/leather combo"}
              {activeTab === "last-approval" && "16 new lasts — track approval status and notes per last"}
              {activeTab === "fitting" && "Style-level fit commentary and imagery for all styles on new lasts"}
              {activeTab === "specs" && "Product specification sheets — per-colour component details for all new styles"}
              {activeTab === "season-analysis" && "Import Total Season reports and surface hot sellers, colour insights, and SKU coverage"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: "oklch(0.96 0.06 65)", color: "oklch(0.50 0.14 55)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              {skuData.summary.newSKUs} New SKUs
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: "oklch(0.95 0.004 80)", color: "oklch(0.45 0.008 60)" }}>
              {skuData.summary.existingSKUs} Existing
            </span>
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </header>

        {/* Scrollable content area — hidden when Specs is active (needs full height) */}
        {activeTab !== "specs" && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-8 py-6">
              {activeTab === "overview" && <SummaryCards />}
              {activeTab === "categories" && <CategoryTab />}
              {activeTab === "styles" && <StylesTab />}
              {activeTab === "leathers" && <LeathersTab />}
              {activeTab === "colours" && <ColoursTab />}
              {activeTab === "colourleather" && <ColourLeatherTab />}
              {activeTab === "expansion" && <ExpansionTab />}
              {activeTab === "buy-sessions" && <BuySessionsPanel />}
              {activeTab === "buy-analysis" && <BuyAnalysisTab />}
              {activeTab === "last-approval" && <LastApprovalTab />}
              {activeTab === "fitting" && <FittingTab />}
              {activeTab === "season-analysis" && <SeasonAnalysisTab />}
            </div>
          </div>
        )}
        {/* Specs tab — full height, split-pane layout */}
        {activeTab === "specs" && (
          <div className="flex-1 overflow-hidden">
            <SpecsTab />
          </div>
        )}
      </main>

      {/* Export Panel */}
      {showExport && (
        <ExportPanel onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "oklch(0.60 0.01 80)" }}>{label}</span>
      <span
        className="text-sm font-semibold font-display tabular-nums"
        style={{ color: highlight ? "var(--sidebar-primary)" : "var(--sidebar-foreground)" }}
      >
        {value}
      </span>
    </div>
  );
}
