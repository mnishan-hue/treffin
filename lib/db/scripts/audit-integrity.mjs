import pg from "pg";

const connectionString = process.env.STAGING_DATABASE_URL;
if (!connectionString) {
  throw new Error("STAGING_DATABASE_URL is required; production fallbacks are intentionally disabled.");
}

const baseChecks = [  ["orphan_comment_authors", `SELECT count(*)::int AS count FROM comments c LEFT JOIN users u ON u.id = c.author_id WHERE u.id IS NULL`],
  ["orphan_comment_posts", `SELECT count(*)::int AS count FROM comments c LEFT JOIN posts p ON p.id = c.post_id WHERE c.post_id IS NOT NULL AND p.id IS NULL`],
  ["orphan_comment_debates", `SELECT count(*)::int AS count FROM comments c LEFT JOIN debates d ON d.id = c.debate_id WHERE c.debate_id IS NOT NULL AND d.id IS NULL`],
  ["orphan_article_authors", `SELECT count(*)::int AS count FROM articles a LEFT JOIN users u ON u.id = a.author_id WHERE u.id IS NULL`],
  ["orphan_article_likes", `SELECT count(*)::int AS count FROM article_likes l LEFT JOIN articles a ON a.id = l.article_id WHERE a.id IS NULL`],
  ["orphan_post_authors", `SELECT count(*)::int AS count FROM posts p LEFT JOIN users u ON u.id = p.author_id WHERE u.id IS NULL`],
  ["orphan_post_communities", `SELECT count(*)::int AS count FROM posts p LEFT JOIN communities c ON c.id = p.community_id WHERE p.community_id IS NOT NULL AND c.id IS NULL`],
  ["orphan_community_creators", `SELECT count(*)::int AS count FROM communities c LEFT JOIN users u ON u.id = c.creator_id WHERE c.creator_id IS NOT NULL AND u.id IS NULL`],
  ["orphan_community_members", `SELECT count(*)::int AS count FROM community_members m LEFT JOIN users u ON u.id = m.user_id LEFT JOIN communities c ON c.id = m.community_id WHERE u.id IS NULL OR c.id IS NULL`],
  ["duplicate_community_members", `SELECT count(*)::int AS count FROM (SELECT community_id, user_id FROM community_members GROUP BY community_id, user_id HAVING count(*) > 1) duplicates`],
  ["community_member_counter_drift", `SELECT count(*)::int AS count FROM communities c WHERE c.member_count <> (SELECT count(*) FROM community_members m WHERE m.community_id = c.id AND m.status = 'member')`],
  ["community_post_counter_drift", `SELECT count(*)::int AS count FROM communities c WHERE c.total_posts <> (SELECT count(*) FROM posts p WHERE p.community_id = c.id AND p.is_removed = false)`],
  ["article_like_counter_drift", `SELECT count(*)::int AS count FROM articles a WHERE a.likes <> (SELECT count(*) FROM article_likes l WHERE l.article_id = a.id)`],
];

const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
let failed = false;
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const columnResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'comments'
          AND column_name = 'article_id'
      ) AS exists
    `);
    const hasArticleId = Boolean(columnResult.rows[0]?.exists);
    const targetColumns = hasArticleId
      ? ["post_id", "article_id", "debate_id"]
      : ["post_id", "debate_id"];
    const nullTargets = targetColumns.map((column) => `${column} IS NULL`).join(" AND ");
    const targetCount = targetColumns.map((column) => `(${column} IS NOT NULL)::int`).join(" + ");
    const checks = [      ...(hasArticleId ? [["orphan_comment_articles", `SELECT count(*)::int AS count FROM comments c LEFT JOIN articles a ON a.id = c.article_id WHERE c.article_id IS NOT NULL AND a.id IS NULL`]] : []),
      ...baseChecks,
    ];

    process.stdout.write(`INFO schema_state: ${hasArticleId ? "post-migration" : "pre-migration"}\n`);
    for (const [name, sql] of checks) {
      try {
        const result = await client.query(sql);
        const count = Number(result.rows[0]?.count ?? 0);
        if (count > 0) failed = true;
        process.stdout.write(`${count === 0 ? "PASS" : "FAIL"} ${name}: ${count}\n`);
      } catch (error) {
        failed = true;
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "QUERY_ERROR";
        process.stdout.write(`ERROR ${name}: ${code}\n`);
      }
    }
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
} finally {
  await pool.end();
}

if (failed) process.exitCode = 1;