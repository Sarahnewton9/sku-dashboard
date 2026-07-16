/**
 * BuySessionBar — sticky bar shown above the By Style tab
 * Shows the active buy session name and provides create/lock controls
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Lock, Unlock, Plus, ChevronDown, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useSeason } from "@/contexts/SeasonContext";

interface Props {
  activeSession: { id: number; name: string; isLocked: boolean; createdAt: Date } | null | undefined;
  allSessions: { id: number; name: string; isLocked: boolean; createdAt: Date; lockedAt: Date | null }[];
  selectedSessionId: number | null;
  onSelectSession: (id: number) => void;
  onDeselect: () => void;
  onSessionChange: () => void;
}

export default function BuySessionBar({
  activeSession,
  allSessions,
  selectedSessionId,
  onSelectSession,
  onDeselect,
  onSessionChange,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const utils = trpc.useUtils();
  const { season } = useSeason();

  const createMutation = trpc.buy.create.useMutation({
    onSuccess: (session) => {
      toast.success(`Buy session "${session?.name}" created`);
      setShowCreate(false);
      setNewName("");
      onSessionChange();
      if (session?.id) onSelectSession(session.id);
    },
    onError: (err) => toast.error(`Failed to create session: ${err.message}`),
  });

  const lockMutation = trpc.buy.lock.useMutation({
    onSuccess: () => {
      toast.success("Buy session locked — it can no longer be edited");
      onSessionChange();
    },
    onError: (err) => toast.error(`Failed to lock session: ${err.message}`),
  });

  const unlockMutation = trpc.buy.unlock.useMutation({
    onSuccess: () => {
      toast.success("Buy session unlocked — you can now edit quantities");
      onSessionChange();
    },
    onError: (err) => toast.error(`Failed to unlock session: ${err.message}`),
  });

  function handleUnlock() {
    if (!selectedSession) return;
    if (!confirm(`Unlock "${selectedSession.name}"? This will allow quantities to be edited again.`)) return;
    unlockMutation.mutate({ sessionId: selectedSession.id });
  }

  function handleCreate() {
    const name = newName.trim() || `Buy — ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}`;
    createMutation.mutate({ name, season });
  }

  function handleLock() {
    if (!activeSession) return;
    if (!confirm(`Lock "${activeSession.name}"? This cannot be undone — the session will become read-only.`)) return;
    lockMutation.mutate({ sessionId: activeSession.id });
  }

  const selectedSession = allSessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Session selector */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-shrink-0">Buy Session:</span>
          <div className="relative">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors hover:bg-muted/50"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              {selectedSession ? (
                <>
                  {selectedSession.isLocked
                    ? <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    : <Clock className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />}
                  <span className="truncate max-w-48">{selectedSession.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">No session selected</span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
            </button>

            {showHistory && (
              <div
                className="absolute top-full left-0 mt-1 w-72 rounded-xl border shadow-lg z-20 overflow-hidden"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All Buy Sessions</p>
                </div>
                {/* No session option */}
                <button
                  onClick={() => { onDeselect(); setShowHistory(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors border-b"
                  style={{ borderColor: "var(--border)", background: selectedSessionId === null ? "oklch(0.97 0.04 65 / 0.6)" : undefined }}
                >
                  <span className="text-muted-foreground text-sm">— No session —</span>
                </button>
                {allSessions.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">No sessions yet</div>
                ) : (
                  <div className="max-h-48 overflow-y-auto">
                    {[...allSessions].reverse().map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { onSelectSession(s.id); setShowHistory(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors"
                        style={{ background: selectedSessionId === s.id ? "oklch(0.97 0.04 65 / 0.6)" : undefined }}
                      >
                        {s.isLocked
                          ? <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          : <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#f59e0b" }} />}
                        <span className="flex-1 truncate font-medium text-foreground">{s.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(s.createdAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
                        </span>
                        {s.isLocked && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                            style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>Locked</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status badge */}
          {selectedSession && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
              style={selectedSession.isLocked
                ? { background: "var(--muted)", color: "var(--muted-foreground)" }
                : { background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}
            >
              {selectedSession.isLocked ? "Locked" : "Active"}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Unlock selected locked session */}
          {selectedSession?.isLocked && (
            <button
              onClick={handleUnlock}
              disabled={unlockMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              <Unlock className="w-3.5 h-3.5" />
              Unlock Session
            </button>
          )}

          {/* Lock active session */}
          {activeSession && selectedSessionId === activeSession.id && !activeSession.isLocked && (
            <button
              onClick={handleLock}
              disabled={lockMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-red-50 hover:border-red-300 hover:text-red-700"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              <Lock className="w-3.5 h-3.5" />
              Lock Session
            </button>
          )}

          {/* Create new session */}
          {showCreate ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
                placeholder={`Buy — ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}`}
                autoFocus
                className="px-3 py-1.5 rounded-lg border text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40 w-56"
                style={{ borderColor: "var(--border)" }}
              />
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "#f59e0b", color: "white" }}
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-muted"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              New Session
            </button>
          )}
        </div>
      </div>

      {/* Hint */}
      {!selectedSession && (
        <p className="text-xs text-muted-foreground mt-2">
          Select a session to view or enter buy quantities, or create a new one to start a fresh buy round.
        </p>
      )}
      {selectedSession && selectedSession.isLocked && (
        <p className="text-xs text-muted-foreground mt-2">
          This session is locked and read-only. Create a new session to enter quantities for a new buy round.
        </p>
      )}
    </div>
  );
}
