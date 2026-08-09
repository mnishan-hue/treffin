-- 0002_comments_compatibility.sql
-- Idempotently aligns production comment storage with the API schema.
-- This migration only adds missing structures; it does not delete or rewrite data.
ALTER TABLE comments ADD COLUMN IF NOT EXISTS article_id integer;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at timestamp;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_removed boolean NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS removed_reason text;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS pinned_at timestamp;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS replies_locked boolean NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS sources text;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS word_count integer;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS toxicity_flagged boolean NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS ai_suspected boolean NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS comments_article_id_idx ON comments(article_id);
CREATE INDEX IF NOT EXISTS comments_debate_id_idx ON comments(debate_id);
CREATE INDEX IF NOT EXISTS comments_author_id_idx ON comments(author_id);

CREATE TABLE IF NOT EXISTS comment_likes (
  id serial PRIMARY KEY,
  comment_id integer NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS comment_likes_comment_user_unique ON comment_likes(comment_id, user_id);
CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS comment_likes_user_id_idx ON comment_likes(user_id);

CREATE TABLE IF NOT EXISTS comment_reactions (
  id serial PRIMARY KEY,
  comment_id integer NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  reaction text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS comment_reactions_comment_user_unique ON comment_reactions(comment_id, user_id);
CREATE INDEX IF NOT EXISTS comment_reactions_comment_id_idx ON comment_reactions(comment_id);