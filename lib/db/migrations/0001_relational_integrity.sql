-- 0001_relational_integrity.sql
-- Adds new relationships without guessing whether legacy post_id rows belonged
-- to articles. Existing ambiguous rows remain post comments for manual review.
ALTER TABLE comments ADD COLUMN IF NOT EXISTS article_id integer;
CREATE INDEX IF NOT EXISTS comments_article_id_idx ON comments(article_id);

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_target_check;
ALTER TABLE comments ADD CONSTRAINT comments_target_check CHECK (
  ((post_id IS NOT NULL)::int + (article_id IS NOT NULL)::int + (debate_id IS NOT NULL)::int) = 1
) NOT VALID;

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_article_fk;
ALTER TABLE comments ADD CONSTRAINT comments_article_fk FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_debate_fk;
ALTER TABLE comments ADD CONSTRAINT comments_debate_fk FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_author_fk;
ALTER TABLE comments ADD CONSTRAINT comments_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_author_fk;
ALTER TABLE articles ADD CONSTRAINT articles_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE article_likes DROP CONSTRAINT IF EXISTS article_likes_article_fk;
ALTER TABLE article_likes ADD CONSTRAINT article_likes_article_fk FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE communities DROP CONSTRAINT IF EXISTS communities_creator_fk;
ALTER TABLE communities ADD CONSTRAINT communities_creator_fk FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE community_members DROP CONSTRAINT IF EXISTS community_members_user_fk;
ALTER TABLE community_members ADD CONSTRAINT community_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_author_fk;
ALTER TABLE posts ADD CONSTRAINT posts_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_community_fk;
ALTER TABLE posts ADD CONSTRAINT posts_community_fk FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE NOT VALID;

-- Reconcile denormalized counters from authoritative rows.
UPDATE communities c SET member_count = (SELECT count(*) FROM community_members m WHERE m.community_id = c.id AND m.status = 'member');
UPDATE communities c SET total_posts = (SELECT count(*) FROM posts p WHERE p.community_id = c.id AND p.is_removed = false);
UPDATE articles a SET likes = (SELECT count(*) FROM article_likes l WHERE l.article_id = a.id);
UPDATE users u SET articles_published = (SELECT count(*) FROM articles a WHERE a.author_id = u.id AND a.status = 'published' AND a.is_removed = false);