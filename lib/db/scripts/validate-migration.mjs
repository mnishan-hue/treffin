import { readdir, readFile } from "node:fs/promises";

const migrationsUrl = new URL("../migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationsUrl))
  .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/i.test(name))
  .sort();
const requiredByFile = {
  "0001_relational_integrity.sql": ["ADD COLUMN IF NOT EXISTS article_id", "comments_target_check", "NOT VALID", "comments_article_fk", "articles_author_fk", "community_members_user_fk", "posts_community_fk"],
  "0002_comments_compatibility.sql": ["ADD COLUMN IF NOT EXISTS article_id", "CREATE TABLE IF NOT EXISTS comment_likes", "CREATE TABLE IF NOT EXISTS comment_reactions"],
  "0003_better_auth_identity_bridge.sql": ["UPDATE users AS target", "SET clerk_id = target.better_auth_id", "NOT EXISTS"],
};
const forbidden = [/\bDROP\s+TABLE\b/i, /\bTRUNCATE\b/i, /\bDELETE\s+FROM\b/i];

for (const [file, required] of Object.entries(requiredByFile)) {
  if (!migrationFiles.includes(file)) throw new Error(`Missing migration: ${file}`);
  const sql = await readFile(new URL(file, migrationsUrl), "utf8");
  for (const marker of required) {
    if (!sql.includes(marker)) throw new Error(`${file} is missing required marker: ${marker}`);
  }
  for (const pattern of forbidden) {
    if (pattern.test(sql)) throw new Error(`${file} contains forbidden destructive statement: ${pattern}`);
  }
}
process.stdout.write(`${migrationFiles.length} migration(s) passed safety validation.\n`);