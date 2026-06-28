import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AdminUser {
  id: number;
  name: string;
  title: string;
  reputationScore: number;
  isVerified: boolean;
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
  debatesJoined: number;
  articlesPublished: number;
  streakDays: number;
  repHistory: RepEvent[];
}

export default function Users() {
  const [data, setData] = useState<AdminUsersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
      return;
    }
    setExpandedId(userId);
    setDetail(null);
    setDetailLoading(true);
    api.get<UserDetail>(`/admin/users/${userId}`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">User Directory</h2>
      <p className="text-sm text-muted-foreground mb-4">Tap any card to view full profile and rep history</p>

      {loading ? (
        <div className="text-muted-foreground py-8 text-center">Loading…</div>
      ) : data ? (
        <>
          <div className="flex flex-col gap-2 mb-4">
            {data.users.map((u) => (
              <div key={u.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-3 py-3 min-h-[56px] flex items-center gap-3 hover:bg-accent/30 transition-colors"
                  onClick={() => handleCardClick(u.id)}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground flex items-center gap-1 flex-wrap">
                      {u.name}
                      {u.isVerified && <span className="text-primary" title="Verified">✓</span>}
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { label: "Rep Score", value: detail.reputationScore.toLocaleString() },
                            { label: "Debates", value: detail.debatesJoined },
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
