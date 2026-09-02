import { FeedPost } from "@workspace/api-client-react";
import { PostCard } from "./post-card";

export function KnowledgeCard({ post }: { post: FeedPost }) {
  return (
    <div data-testid={`card-knowledge-${post.id}`}>
      <PostCard post={post} variant="knowledge" />
    </div>
  );
}
