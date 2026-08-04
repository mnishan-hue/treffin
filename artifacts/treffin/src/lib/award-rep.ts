import { awardReputation } from "@workspace/api-client-react";

export type RepEventType =
  | "post_created"
  | "post_liked"
  | "article_created"
  | "article_liked"
  | "debate_joined"
  | "debate_won"
  | "daily_question_voted"
  | "weekly_challenge_won"
  | "community_joined"
  | "streak_bonus"
  | "comment_posted"
  | "content_saved"
  | "profile_completed"
  | "long_comment";

export async function awardRepApi(
  eventType: RepEventType,
  description: string,
  referenceId?: number
): Promise<void> {
  try {
    await awardReputation({ eventType, description, referenceId });
  } catch {
    // fire-and-forget — never break the UX if rep award fails
  }
}
