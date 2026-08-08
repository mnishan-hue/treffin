import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../migrations/0001_relational_integrity.sql", import.meta.url);
const sql = await readFile(migrationUrl, "utf8");
const required = [
  "ADD COLUMN IF NOT EXISTS article_id",
  "comments_target_check",
  "NOT VALID",
  "comments_article_fk",
  "articles_author_fk",
  "community_members_user_fk",
  "posts_community_fk",
];
const forbidden = [/\bDROP\s+TABLE\b/i, /\bTRUNCATE\b/i, /\bDELETE\s+FROM\b/i];

for (const marker of required) {
  if (!sql.includes(marker)) throw new Error(`Migration is missing required marker: ${marker}`);
}
for (const pattern of forbidden) {
  if (pattern.test(sql)) throw new Error(`Migration contains forbidden destructive statement: ${pattern}`);
}
process.stdout.write("Migration safety validation passed.\n");