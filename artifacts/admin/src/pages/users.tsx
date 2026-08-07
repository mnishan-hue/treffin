import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AdminUser {
  id: number;
  name: string;
  title: string;
  reputationScore: number;
  isVerified: boolean;
  isSuspended: boolean;
  createdAt: string;
}

interface AdminUsersPage {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

interface RepEvent {
  id: number;
  eventType: string;
  points: number;
  description: string;
  createdAt: string;
}

interface UserDetail extends AdminUser {
  bio: string | null;
  followers: number;
  following: number;
  debatesCreated: number;
  articlesPublished: number;
  streakDays: number;
  suspendedReason: string | null;
  repHistory: RepEvent[];
}

export default function Users() {
  const [data, setData] = useState<AdminUsersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [sampleDeleteConfirm, setSampleDeleteConfirm] = useState(false);
  const [sampleDeleteLoading, setSampleDeleteLoading] = useState(false);
  const [sampleDeleteResult, setSampleDeleteResult] = useState<string | null>(null);

  const load = (p: number) => {
    setLoading(true);
    api.get<AdminUsersPage>(`/admin/users?page=${p}`)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(page); }, [page]);

  const handleCardClick = (userId: number) => {
    if (expandedId === userId) {
      setExpandedId(null);
      setDetail(null);
      setSuspendReason("");
      setDeleteConfirmId(null);
      return;
    }
    setExpandedId(userId);
    setDetail(null);
    setDetailLoading(true);
    setDeleteConfirmId(null);
    api.get<UserDetail>(`/admin/users/${userId}`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  };

  const handleSuspendToggle = async (userId: number, suspend: boolean) => {
    setSuspendLoading(true);
    try {
      await api.patch(`/admin/users/${userId}/suspend`, {
        isSuspended: suspend,
        reason: suspend ? suspendReason : undefined,
      });
      const [updatedDetail, updatedList] = await Promise.all([
        api.get<UserDetail>(`/admin/users/${userId}`),
        api.get<AdminUsersPage>(`/admin/users?page=${page}`),
      ]);
      setDetail(updatedDetail);
      setData(updatedList);
      setSuspendReason("");
    } catch {
      // error surfaced via global handler
    } finally {
      setSuspendLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (deleteConfirmId !== userId) {
      setDeleteConfirmId(userId);
      return;
    }
    setDeleteLoading(true);
    try {
      await api.delete(`/admin/users/${userId}`);
      setExpandedId(null);
      setDetail(null);
      setDeleteConfirmId(null);
      load(page);
    } catch {
      // error surfaced via global handler
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteSampleUsers = async () => {
    if (!sampleDeleteConfirm) {
      setSampleDeleteConfirm(true);
      return;
    }
    setSampleDeleteLoading(true);
    setSampleDeleteResult(null);
    try {
      const result = await api.delete<{ ok: boolean; deleted: number; message?: string }>("/admin/users/sample");
      setSampleDeleteResult(
        result.deleted === 0
          ? "No sample users found — list is already clean."
          : `Done. ${result.deleted} sample user${result.deleted === 1 ? "" : "s"} permanently deleted.`
      );
      setSampleDeleteConfirm(false);
      load(page);
    } catch {
      setSampleDeleteResult("Failed to delete sample users. Check server logs.");
    } finally {
      setSampleDeleteLoading(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div>
      <div className="flex items-start justify-between mb-1 gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">User Directory</h2>
          <p className="text-sm text-muted-foreground">Tap any card to view full profile and rep history</p>
        </div>

        {/* Delete sample users */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {sampleDeleteResult && (
            <p className="text-xs text-muted-foreground text-right max-w-[220px]">{sampleDeleteResult}</p>
          )}
          {sampleDeleteConfirm ? (
            <div className="flex gap-1.5">
              <button
                onClick={() => { setSampleDeleteConfirm(false); setSampleDeleteResult(null); }}
                className="px-3 py-1.5 text-xs rounded-lg bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={sampleDeleteLoading}
                onClick={handleDeleteSampleUsers}
                className="px-3 py-1.5 text-xs rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 disabled:opacity-50 transition-colors font-semibold"
              >
                {sampleDeleteLoading ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeleteSampleUsers}
              className="px-3 py-1.5 text-xs rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
            >
              🗑 Delete Sample Users
            </button>
          )}
        </div>
      </div>

      <div className="mb-4" />

      {loading ? (
        <div className="text-muted-foreground py-8 text-center">Loading…</div>
      ) : data ? (
        <>
          <div className="flex flex-col gap-2 mb-4">
            {data.users.map((u) => (
              <div key={u.id} className={`bg-card border rounded-xl overflow-hidden ${u.isSuspended ? "border-red-500/40" : "border-border"}`}>
                <button
                  className="w-full text-left px-3 py-3 min-h-[56px] flex items-center gap-3 hover:bg-accent/30 transition-colors"
                  onClick={() => handleCardClick(u.id)}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${u.isSuspended ? "bg-red-500/20 border border-red-500/40 text-red-400" : "bg-primary/20 border border-primary/30 text-primary"}`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground flex items-center gap-1 flex-wrap">
                      {u.name}
                      {u.isVerified && <span className="text-primary" title="Verified">✓</span>}
                      {u.isSuspended && (
                        <span className="text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30 rounded px-1 py-0.5 leading-none">
                          SUSPENDED
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{u.title}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-foreground">{u.reputationScore.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">rep</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground ml-1">
                    {expandedId === u.id ? "▲" : "▼"}
                  </span>
                </button>

                {expandedId === u.id && (
                  <div className="border-t border-border/50 px-3 py-4">
                    {detailLoading ? (
                      <div className="text-xs text-muted-foreground py-2">Loading profile…</div>
                    ) : detail ? (
                      <div className="flex flex-col gap-4">
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(detail.createdAt).toLocaleDateString()}
                        </p>

                        {detail.isSuspended && detail.suspendedReason && (
                          <div className="text-xs bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2 text-red-400">
                            <span className="font-semibold">Suspension reason: </span>{detail.suspendedReason}
                          </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { label: "Rep Score", value: detail.reputationScore.toLocaleString() },
                            { label: "Debates Created", value: detail.debatesCreated },
                            { label: "Articles", value: detail.articlesPublished },
                            { label: "Followers", value: detail.followers },
                            { label: "Following", value: detail.following },
                            { label: "Streak", value: `${detail.streakDays}d` },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-background border border-border rounded-lg px-3 py-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                              <p className="font-bold text-foreground text-sm">{value}</p>
                            </div>
                          ))}
                        </div>

                        {detail.bio && (
                          <div className="text-xs text-muted-foreground bg-background border border-border rounded-lg px-3 py-2">
                            <span className="font-medium text-foreground">Bio: </span>{detail.bio}
                          </div>
                        )}

                        {/* Account Control */}
                        <div className="bg-background border border-border rounded-lg px-3 py-3 flex flex-col gap-2">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Account Control</p>
                          {detail.isSuspended ? (
                            <button
                              disabled={suspendLoading}
                              onClick={() => handleSuspendToggle(detail.id, false)}
                              className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 disabled:opacity-50 transition-colors"
                            >
                              {suspendLoading ? "Processing…" : "✓ Unsuspend User"}
                            </button>
                          ) : (
                            <>
                              <input
                                type="text"
                                placeholder="Suspension reason (required)"
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-red-500/50"
                              />
                              <button
                                disabled={suspendLoading || !suspendReason.trim()}
                                onClick={() => handleSuspendToggle(detail.id, true)}
                                className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50 transition-colors"
                              >
                                {suspendLoading ? "Processing…" : "Suspend User"}
                              </button>
                            </>
                          )}

                          {/* Permanent delete — two-click */}
                          <div className="border-t border-border/40 pt-2 mt-1">
                            {deleteConfirmId === detail.id ? (
                              <div className="flex flex-col gap-1.5">
                                <p className="text-[11px] text-red-400 font-medium text-center">
                                  This permanently deletes the user and all their content. Cannot be undone.
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    disabled={deleteLoading}
                                    onClick={() => handleDeleteUser(detail.id)}
                                    className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 disabled:opacity-50 transition-colors"
                                  >
                                    {deleteLoading ? "Deleting…" : "Yes, Delete Permanently"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleDeleteUser(detail.id)}
                                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-red-500/70 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
                              >
                                Delete User Permanently
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Rep History</p>
                          {detail.repHistory.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No reputation events recorded yet.</p>
                          ) : (
                            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto scrollbar-none">
                              {detail.repHistory.map((e) => (
                                <div key={e.id} className="flex items-center gap-3 bg-background border border-border/60 rounded-lg px-3 py-2 text-xs">
                                  <span className={`font-bold shrink-0 ${e.points > 0 ? "text-green-400" : "text-red-400"}`}>
                                    {e.points > 0 ? "+" : ""}{e.points}
                                  </span>
                                  <span className="text-foreground flex-1 min-w-0">{e.description}</span>
                                  <span className="text-muted-foreground shrink-0">{new Date(e.createdAt).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Could not load profile.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {data.users.length === 0 && (
              <div className="bg-card border border-border rounded-xl py-12 text-center text-muted-foreground text-sm">No users yet</div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex-1 px-3 py-2.5 min-h-[40px] bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-accent disabled:opacity-50 transition-colors"
              >
                ← Prev
              </button>
              <span className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex-1 px-3 py-2.5 min-h-[40px] bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-accent disabled:opacity-50 transition-colors"
              >
                Next →
              </button>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-2 text-center">{data.total} users total</p>
        </>
      ) : null}
    </div>
  );
}
