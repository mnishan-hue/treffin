import { Router } from "express";
import { db } from "@workspace/db";
import { debatesTable, articlesTable, usersTable, communitiesTable } from "@workspace/db";
import { ilike, desc, or } from "drizzle-orm";

const router = Router();

router.get("/search", async (req, res) => {
  const qRaw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!qRaw) {
    res.json({ debates: [], articles: [], users: [], communities: [] });
    return;
  }
  const pattern = `%${qRaw}%`;

  try {
    const [debates, articles, users, communities] = await Promise.all([
      db.select().from(debatesTable).where(ilike(debatesTable.title, pattern)).orderBy(desc(debatesTable.createdAt)).limit(5),
      db.select().from(articlesTable).where(ilike(articlesTable.title, pattern)).orderBy(desc(articlesTable.createdAt)).limit(5),
      db.select().from(usersTable).where(or(ilike(usersTable.name, pattern), ilike(usersTable.title, pattern))).orderBy(desc(usersTable.reputationScore)).limit(5),
      db.select().from(communitiesTable).where(or(ilike(communitiesTable.name, pattern), ilike(communitiesTable.description, pattern))).orderBy(desc(communitiesTable.memberCount)).limit(5),
    ]);

    res.json({
      debates: debates.map(d => ({ id: d.id, title: d.title, category: d.category ?? null })),
      articles: articles.map(a => ({ id: a.id, title: a.title, category: a.category ?? null })),
      users: users.map(u => ({ id: u.id, name: u.name, title: u.title, avatarUrl: u.avatarUrl ?? null })),
      communities: communities.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, category: c.category })),
    });
  } catch (err) {
    req.log.error({ err }, "Search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
