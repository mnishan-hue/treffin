import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AdminTopic {
  id: number;
  name: string;
  color: string;
  slug: string | null;
  icon: string | null;
  description: string | null;
}

type Mode = "view" | "create" | "edit";

const emptyForm = () => ({ name: "", color: "#6366f1", slug: "", icon: "💡", description: "" });

export default function Topics() {
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("view");
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get<AdminTopic[]>("/admin/topics")
      .then(setTopics)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startEdit = (t: AdminTopic) => {
    setEditId(t.id);
    setForm({ name: t.name, color: t.color, slug: t.slug ?? "", icon: t.icon ?? "", description: t.description ?? "" });
    setMode("edit");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "create") {
        await api.post("/admin/topics", form);
      } else if (mode === "edit" && editId) {
        await api.patch(`/admin/topics/${editId}`, form);
      }
      setMode("view");
      setForm(emptyForm());
      setEditId(null);
      load();
    } catch {}
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/admin/topics/${id}`);
    setConfirmId(null);
    load();
  };

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-xl font-bold text-foreground">Topics</h2>
        {mode === "view" && (
          <button
            onClick={() => { setMode("create"); setForm(emptyForm()); }}
            className="px-4 py-2.5 min-h-[40px] bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
          >
            + Add Topic
          </button>
        )}
      </div>

      {mode !== "view" && (
        <div className="bg-card border border-border rounded-xl p-4 mb-5">
          <h3 className="font-semibold text-foreground mb-4">{mode === "create" ? "Create Topic" : "Edit Topic"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  placeholder="Philosophy"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  placeholder="philosophy"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Icon (emoji)</label>
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  placeholder="💡"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-background shrink-0"
                  />
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="flex-1 px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    placeholder="#6366f1"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                placeholder="Explore fundamental questions about existence, knowledge, and ethics"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="px-5 py-2.5 min-h-[40px] bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {submitting ? "Saving…" : mode === "create" ? "Create" : "Update"}
              </button>
              <button type="button" onClick={() => { setMode("view"); setForm(emptyForm()); setEditId(null); }} className="px-5 py-2.5 min-h-[40px] bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-accent transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {topics.map((t) => (
          <div key={t.id} className="bg-card border border-border rounded-xl px-3 py-3">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">{t.icon ?? "🏷️"}</span>
              <span className="w-3 h-3 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: t.color }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{t.name}</p>
                {(t.slug || t.description) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.slug && <span className="mr-2">/{t.slug}</span>}
                    {t.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-border/50">
              <button
                onClick={() => startEdit(t)}
                className="text-xs px-3 py-2.5 min-h-[40px] bg-secondary text-secondary-foreground rounded-lg hover:bg-accent transition-colors"
              >
                Edit
              </button>
              {confirmId === t.id ? (
                <span className="inline-flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sure?</span>
                  <button onClick={() => handleDelete(t.id)} className="text-xs px-3 py-2.5 min-h-[40px] bg-destructive text-destructive-foreground rounded-lg">Yes</button>
                  <button onClick={() => setConfirmId(null)} className="text-xs px-3 py-2.5 min-h-[40px] bg-secondary text-secondary-foreground rounded-lg">No</button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmId(t.id)}
                  className="text-xs px-3 py-2.5 min-h-[40px] bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive hover:text-white transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
        {topics.length === 0 && (
          <div className="bg-card border border-border rounded-xl py-12 text-center text-muted-foreground text-sm">No topics yet</div>
        )}
      </div>
    </div>
  );
}
