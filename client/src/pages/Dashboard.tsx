/**
 * SKU Analysis Dashboard — Main Page
 * Design: Refined Analytical Dashboard
 * - Warm off-white background, Sora headings + Inter body
 * - Amber accent for new SKUs, slate sidebar
 * - Fixed left sidebar, tabbed main content
 *
 * Tab routing: each section has its own URL path (e.g. /styles, /fitting).
 * Active tab is derived from the current URL so links are shareable.
 */

import { useMemo, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { skuData } from "@/lib/skuData";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { useCancelledStyles } from "@/hooks/useCancelledStyles";
import { trpc } from "@/lib/trpc";
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
import { MarkdownTab } from "@/components/dashboard/MarkdownTab";
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
  TagsIcon,
  MessageSquare,
  X,
  Send,
  Loader2,
  Sparkles,
} from "lucide-react";

type Tab = "overview" | "categories" | "styles" | "leathers" | "colours" | "colourleather" | "expansion" | "buy-sessions" | "buy-analysis" | "last-approval" | "fitting" | "specs" | "season-analysis" | "markdown";

const VALID_TABS = new Set<Tab>([
  "overview", "categories", "styles", "leathers", "colours",
  "colourleather", "expansion", "buy-sessions", "buy-analysis",
  "last-approval", "fitting", "specs", "season-analysis", "markdown",
]);

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
  { id: "markdown", label: "Markdowns", icon: TagsIcon, group: "analysis" },
];

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function Dashboard() {
  const [location, navigate] = useLocation();
  const [showExport, setShowExport] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const chatMutation = trpc.chat.command.useMutation({
    onSuccess: (data) => {
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      // Invalidate relevant queries so the UI reflects the change immediately
      if (data.action) {
        const actionType = (data.action as { type: string }).type;
        if (actionType === "mark_sku_new_or_existing") {
          utils.skuNewOverride.getAll.invalidate();
        } else if (actionType === "update_sample_status") {
          utils.sku.getAll.invalidate();
        } else if (actionType === "cancel_sku" || actionType === "restore_sku") {
          utils.cancelledSku.list.invalidate();
        } else if (actionType === "cancel_style") {
          utils.styles.listCancelled.invalidate();
        }
      }
    },
    onError: (err) => {
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Sorry, something went wrong: ${err.message}` }]);
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  function handleChatSend() {
    const text = chatInput.trim();
    if (!text || chatMutation.isPending) return;
    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: text }];
    setChatMessages(newMessages);
    setChatInput("");
    chatMutation.mutate({ messages: newMessages });
  }

  // Derive active tab from the URL path (strip leading slash)
  const pathTab = location.replace(/^\//, "") as Tab;
  const activeTab: Tab = VALID_TABS.has(pathTab) ? pathTab : "overview";

  const tabLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? "";

  // Live SKU counts (includes custom SKUs from DB, excludes cancelled)
  const { mergedRawSkus } = useCustomSkus();
  const { cancelledSet: cancelledStyleSet } = useCancelledStyles();
  const { data: cancelledSkuList = [] } = trpc.cancelledSku.list.useQuery();
  const cancelledSkuSet = useMemo(() => {
    const s = new Set<string>();
    for (const item of cancelledSkuList as Array<{ style: string; colour: string; leather: string }>) {
      s.add(`${item.style}|${item.colour}|${item.leather}`);
    }
    return s;
  }, [cancelledSkuList]);
  const liveSummary = useMemo(() => {
    const styleSet = new Set<string>();
    let total = 0;
    let newCount = 0;
    for (const sku of mergedRawSkus) {
      if (cancelledStyleSet.has(sku.style)) continue;
      if (cancelledSkuSet.has(`${sku.style}|${sku.colour}|${sku.leather}`)) continue;
      total++;
      if (sku.is_new) newCount++;
      styleSet.add(sku.style);
    }
    return { total, newCount, totalStyles: styleSet.size };
  }, [mergedRawSkus, cancelledStyleSet, cancelledSkuSet]);

  function NavItem({ item }: { item: typeof NAV_ITEMS[0] }) {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <li key={item.id}>
        <a
          href={`/${item.id}`}
          onClick={(e) => { e.preventDefault(); navigate(`/${item.id}`); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 no-underline"
          style={{
            background: isActive ? "var(--sidebar-accent)" : "transparent",
            color: isActive ? "var(--sidebar-primary)" : "var(--sidebar-foreground)",
            display: "flex",
          }}
        >
          <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center"><Icon className="w-4 h-4" /></span>
          <span>{item.label}</span>
          {isActive && (
            <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
          )}
        </a>
      </li>
    );
  }

  return (
    <div className="flex overflow-hidden bg-background" style={{ height: '100dvh' }}>
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
            <StatRow label="Total SKUs" value={liveSummary.total.toLocaleString()} />
            <StatRow
              label="New SKUs"
              value={liveSummary.newCount.toLocaleString()}
              highlight
            />
            <StatRow label="Total Styles" value={liveSummary.totalStyles.toLocaleString()} />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.50 0.01 80)" }}>
            Sections
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter((i) => !i.group).map((item) => (
              <NavItem key={item.id} item={item} />
            ))}
          </ul>
          <p className="px-2 mt-4 mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.50 0.01 80)" }}>
            Buying
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter((i) => i.group === "buying").map((item) => (
              <NavItem key={item.id} item={item} />
            ))}
          </ul>
          <p className="px-2 mt-4 mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.50 0.01 80)" }}>
            Approval
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter((i) => i.group === "approval").map((item) => (
              <NavItem key={item.id} item={item} />
            ))}
          </ul>
          <p className="px-2 mt-4 mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.50 0.01 80)" }}>
            Analysis
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter((i) => i.group === "analysis").map((item) => (
              <NavItem key={item.id} item={item} />
            ))}
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
            {liveSummary.totalStyles} styles · {skuData.summary.uniqueLeathers} leathers · {skuData.summary.uniqueColours} colours
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
              {activeTab === "overview" && `${liveSummary.newCount} new SKUs across ${liveSummary.totalStyles} styles`}
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
              {liveSummary.newCount} New SKUs
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: "oklch(0.95 0.004 80)", color: "oklch(0.45 0.008 60)" }}>
              {liveSummary.total - liveSummary.newCount} Existing
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
              {activeTab === "markdown" && <MarkdownTab />}
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

      {/* ── AI Assistant Floating Button ── */}
      <button
        onClick={() => setShowChat((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-11 h-11 rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
        style={{
          background: showChat ? "oklch(0.35 0.02 60)" : "oklch(0.25 0.02 60)",
          color: "#fff",
          boxShadow: "0 4px 24px oklch(0.25 0.02 60 / 0.35)",
        }}
        title="Quick Edit Assistant"
      >
        <Sparkles className="w-4 h-4" />
      </button>

      {/* ── AI Assistant Chat Panel ── */}
      {showChat && (
        <div
          className="fixed bottom-20 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: "380px",
            height: "480px",
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ background: "oklch(0.25 0.02 60)", color: "#fff" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="font-semibold text-sm">Quick Edit Assistant</span>
            </div>
            <button
              onClick={() => setShowChat(false)}
              className="opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-20" style={{ color: "var(--foreground)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Make quick changes</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Type a command like:</p>
                <div className="mt-3 space-y-1.5">
                  {[
                    "Nesta Vanilla Vintage is not new",
                    "Sample received for Anja Black Patent",
                    "Cancel Edgy Black Capri",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setChatInput(s)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg transition-colors hover:opacity-80"
                      style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed"
                  style={{
                    background: msg.role === "user"
                      ? "oklch(0.25 0.02 60)"
                      : "var(--muted)",
                    color: msg.role === "user" ? "#fff" : "var(--foreground)",
                    borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div
                  className="px-3 py-2 rounded-xl text-sm flex items-center gap-2"
                  style={{ background: "var(--muted)", color: "var(--muted-foreground)", borderRadius: "18px 18px 18px 4px" }}
                >
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Processing...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div
            className="flex-shrink-0 px-3 py-3 flex items-center gap-2"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
              placeholder="Type a change..."
              disabled={chatMutation.isPending}
              className="flex-1 text-sm px-3 py-2 rounded-lg outline-none transition-colors"
              style={{
                background: "var(--muted)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
              }}
            />
            <button
              onClick={handleChatSend}
              disabled={!chatInput.trim() || chatMutation.isPending}
              className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
              style={{ background: "oklch(0.25 0.02 60)", color: "#fff" }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
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
