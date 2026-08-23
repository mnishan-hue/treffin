import { expect, test, type Page, type Route } from "@playwright/test";

const session = {
  session: { id: "session-1", userId: "auth-user", token: "test-token", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  user: { id: "auth-user", name: "Test User", email: "test@example.invalid", image: null },
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${new URL(page.url()).pathname} horizontal overflow`).toBeLessThanOrEqual(1);
}
async function mockAuthenticatedApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === "/api/users/me" && request.method() === "GET") {
      return json(route, { id: 1, betterAuthId: "auth-user", name: "Test User", title: "Thinker", bio: "Stored bio", avatarUrl: null, interests: ["Philosophy", "Science", "History"], reputationScore: 12, followers: 0, following: 0, articlesPublished: 0 });
    }
    if (path === "/api/users/me" && request.method() === "PUT") return json(route, { ok: true, id: 1 });
    if (path === "/api/users/me/interests" && request.method() === "PATCH") return json(route, { ok: true });
    if (path === "/api/reputation") return json(route, { total: 12, breakdown: { debates: 2, articles: 2, community: 2, votes: 2, posts: 4 }, recentEvents: [] });
    if (path === "/api/reputation/settings") return json(route, { eliteThreshold: 1000 });
    if (path === "/api/feed") return json(route, []);
    if (path === "/api/stats/daily-question") return json(route, null);
    if (path === "/api/stats/weekly-challenge") return json(route, null);
    if (path === "/api/debates") return json(route, []);
    if (path === "/api/articles") return json(route, []);
    if (path === "/api/communities") return json(route, []);
    if (path === "/api/users/me/review-requests") return json(route, []);
    if (path === "/api/users/1/positions") return json(route, []);
    if (path === "/api/users/1/dna") return json(route, []);
    if (path === "/api/topics") return json(route, []);
    if (path === "/api/notifications") return json(route, [{ id: 7, userId: "auth-user", type: "reply", title: "New reply", body: "Someone replied", actorName: "A User", actorInitials: "AU", read: false, createdAt: new Date().toISOString() }]);
    if (path === "/api/notifications/preferences") return json(route, { likes: true, replies: true, follows: true, debates: true });
    if (path === "/api/notifications/stream") return route.fulfill({ status: 204 });
    if (path === "/api/notifications/7/read" && request.method() === "PATCH") return json(route, { ok: true });
    if (path === "/api/analytics/me") return json(route, { totals: { rep: 42, repThisWeek: 9, articlesCreated: 2, debatesJoined: 3, postsCreated: 4, commentsPosted: 5 }, repByDay: [], repByCategory: { debates: 10, articles: 10, votes: 5, posts: 12, community: 5 }, eventBreakdown: [] });
    if (path === "/api/users/top-thinkers") return json(route, []);
    return json(route, []);
  });
  await page.route("**/api/auth/get-session", (route) => json(route, session));
}

test.describe("authenticated Treffin contracts", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("treffin_onboarded", "true");
      localStorage.setItem("treffin_welcomed_v1", "1");
      localStorage.setItem("treffin_interests", JSON.stringify(["Philosophy"]));
      localStorage.setItem("treffin_cookie_consent", "accepted");
    });
    await mockAuthenticatedApi(page);
  });

  test("home uses real empty states and does not overflow on phones", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByText("No weekly challenge is open right now.")).toBeVisible();
    await expect(page.getByText("Join the conversation")).toHaveCount(0);
    if (isMobile) await expectNoHorizontalOverflow(page);
  });
  test("home restores authoritative daily vote and weekly submission state", async ({ page, isMobile }) => {
    await page.addInitScript(() => localStorage.setItem("treffin_daily_vote_44", "support"));
    await page.route("**/api/stats/daily-question", (route) => json(route, {
      id: 44,
      question: "Should public reasoning be evidence-led?",
      supportPercent: 40,
      againstPercent: 60,
      participantCount: 25,
      isLive: true,
      imageUrl: null,
      myVote: "against",
    }));
    await page.route("**/api/stats/weekly-challenge", (route) => json(route, {
      id: 5,
      question: "What makes disagreement productive?",
      startDate: new Date(Date.now() - 3_600_000).toISOString(),
      endDate: new Date(Date.now() + 3_600_000).toISOString(),
      isActive: true,
      winnerUserId: null,
      winnerName: null,
      winnerAvatar: null,
      winnerResponse: null,
      hasSubmitted: true,
    }));

    await page.goto("/");
    await expect(page.getByText("Against 60%", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Against/ })).toBeDisabled();
    await expect(page.getByText("Entry submitted. Good luck!", { exact: true })).toBeVisible();
    await expect(page.getByTestId("input-challenge-response")).toHaveCount(0);
    if (isMobile) await expectNoHorizontalOverflow(page);
  });

  test("home records a first daily vote once and uses the server result", async ({ page }) => {
    let voteRequests = 0;
    await page.route("**/api/stats/daily-question**", async (route) => {
      if (route.request().method() === "POST") {
        voteRequests += 1;
        return json(route, {
          id: 45,
          question: "Should public reasoning be evidence-led?",
          supportPercent: 67,
          againstPercent: 33,
          participantCount: 3,
          isLive: true,
          imageUrl: null,
          myVote: "support",
        });
      }
      return json(route, {
        id: 45,
        question: "Should public reasoning be evidence-led?",
        supportPercent: 50,
        againstPercent: 50,
        participantCount: 2,
        isLive: true,
        imageUrl: null,
        myVote: null,
      });
    });

    await page.goto("/");
    const support = page.getByRole("button", { name: /Support/ });
    await support.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    await expect.poll(() => voteRequests).toBe(1);
    await expect(page.getByText("Support 67%", { exact: true })).toBeVisible();
    await expect(support).toBeDisabled();
  });
  test("profile renders database data and persists through the authenticated user API", async ({ page }) => {
    let updateBody: string | null = null;
    await page.route("**/api/users/me", async (route) => {
      if (route.request().method() === "PUT") {
        updateBody = route.request().postData();
        return json(route, { ok: true, id: 1 });
      }
      return json(route, { id: 1, betterAuthId: "auth-user", name: "Test User", title: "Thinker", bio: "Stored bio", avatarUrl: null, interests: ["Philosophy", "Science", "History"], reputationScore: 12, followers: 0, following: 0, articlesPublished: 0 });
    });
    await page.goto("/profile");
    await expect(page.getByText("Stored bio", { exact: true })).toBeVisible();
    const status = await page.evaluate(async () => {
      const response = await fetch("/api/users/me", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: "Database backed bio" }),
      });
      return response.status;
    });
    expect(status).toBe(200);
    await expect.poll(() => updateBody).toContain("Database backed bio");
  });
  test("the configured Elite Thinker threshold drives profiles and the desktop sidebar", async ({ page, isMobile }) => {
    let allTimeLeaderboardRequested = false;
    let syncPayload: Record<string, unknown> | null = null;
    await page.route("**/api/users/me", async (route) => {
      if (route.request().method() === "PUT") {
        syncPayload = route.request().postDataJSON() as Record<string, unknown>;
        return json(route, { ok: true, id: 1 });
      }
      return json(route, {
        id: 1, betterAuthId: "auth-user", name: "Threshold Elite", title: "Elite Thinker",
        bio: null, avatarUrl: null, interests: [], reputationScore: 75,
        followers: 0, following: 0, articlesPublished: 0,
      });
    });
    await page.route("**/api/reputation/settings", (route) => json(route, { eliteThreshold: 50 }));
    await page.route("**/api/reputation", (route) => json(route, {
      total: 75,
      breakdown: { debates: 20, articles: 15, community: 10, votes: 10, posts: 20 },
      recentEvents: [],
    }));
    await page.route("**/api/users/top-thinkers**", (route) => {
      const period = new URL(route.request().url()).searchParams.get("period");
      if (period === "all_time") {
        allTimeLeaderboardRequested = true;
        return json(route, [{
          id: 2,
          name: "Threshold Elite",
          title: "Elite Thinker",
          avatarUrl: null,
          reputationScore: 75,
          periodRep: 75,
          rank: 1,
        }]);
      }
      return json(route, []);
    });

    await page.goto("/");
    await expect(page.getByTestId("home-user-rank")).toHaveText("Elite Thinker");
    if (!isMobile) await expect(page.getByTestId("navbar-user-rank")).toHaveText("Elite Thinker");
    await expect(page.getByText("Level Up!", { exact: true })).toHaveCount(0);
    await expect.poll(() => syncPayload).not.toBeNull();
    expect(syncPayload).not.toHaveProperty("title");

    await page.goto("/profile");
    await expect(page.getByTestId("profile-user-rank")).toHaveText("Elite Thinker");
    if (!isMobile) {
      await expect(page.getByTestId("elite-threshold-label")).toContainText("50+ rep");
      await expect(page.getByText("Threshold Elite", { exact: true }).last()).toBeVisible();
      await expect.poll(() => allTimeLeaderboardRequested).toBe(true);
    }
    await expectNoHorizontalOverflow(page);
  });


  test("notifications load and mark an owned notification read", async ({ page }) => {
    let markedRead = false;
    await page.route("**/api/notifications/7/read", async (route) => { markedRead = route.request().method() === "PATCH"; await json(route, { ok: true }); });
    await page.goto("/notifications");
    await expect(page.getByText("New reply")).toBeVisible();
    await page.getByTestId("notif-7").click();
    await expect.poll(() => markedRead).toBe(true);
  });

  test("analytics renders persisted values rather than fallback zeros", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.getByText("42", { exact: true })).toBeVisible();
    await expect(page.getByText("Analytics could not be loaded")).toHaveCount(0);
  });

  test("article review controls are visible only to the article author", async ({ page }) => {
    await page.route("**/api/articles/4", (route) => json(route, {
      id: 4,
      title: "A public article",
      excerpt: "Summary",
      content: '<img src=x onerror="window.__articleXss = 1">Safe article body',
      imageUrl: null,
      authorId: 2,
      authorName: "Another Author",
      authorTitle: "Member",
      authorAvatar: null,
      category: "Science",
      readTime: 1,
      likes: 0,
      isVerified: false,
      createdAt: new Date().toISOString(),
      isTrending: false,
      isFeatured: false,
      isExpertReviewed: false,
      reviewRequestStatus: null,
      liked: false,
    }));
    await page.route("**/api/articles/4/annotations", (route) => json(route, []));
    await page.route("**/api/articles/4/comments", (route) => json(route, []));

    await page.goto("/articles/4");
    await expect(page.getByRole("heading", { name: "A public article" })).toBeVisible();
    await expect(page.getByTestId("button-peer-review")).toHaveCount(0);
    await expect(page.locator('article img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as typeof window & { __articleXss?: number }).__articleXss)).toBeUndefined();
  });

  test("article list Like and Save controls use connected state", async ({ page }) => {
    let likeRequests = 0;
    await page.route("**/api/articles?**", (route) => json(route, [{
      id: 9, title: "Connected article", excerpt: "Connected summary", content: "Body", imageUrl: null,
      authorId: 2, authorName: "Article Author", authorTitle: "Member", authorAvatar: null, category: "Science",
      readTime: 3, likes: 3, comments: 2, liked: false, isVerified: false, createdAt: new Date().toISOString(),
      isTrending: false, isFeatured: false, isExpertReviewed: false, reviewRequestStatus: null,
    }]));
    await page.route("**/api/articles/9/like", async (route) => {
      likeRequests += 1;
      await json(route, {
        id: 9, title: "Connected article", authorId: 2, authorName: "Article Author", authorTitle: "Member",
        authorAvatar: null, category: "Science", readTime: 3, likes: 4, comments: 2, liked: true,
        isVerified: false, createdAt: new Date().toISOString(), isTrending: false, isFeatured: false, isExpertReviewed: false,
      });
    });

    await page.goto("/articles");
    await page.getByTestId("button-like-article-9").click();
    await expect.poll(() => likeRequests).toBe(1);
    await expect(page.getByTestId("button-like-article-9")).toContainText("4");
    await page.getByTestId("button-save-article-9").click();
    await expect(page.getByTestId("button-save-article-9")).toContainText("Saved");
  });

  test("article authors can submit exactly one connected review request", async ({ page }) => {
    let reviewRequests = 0;
    await page.route("**/api/articles/8", (route) => json(route, {
      id: 8, title: "My reviewable article", excerpt: "Summary", content: "Review body", imageUrl: null,
      authorId: 1, authorName: "Test User", authorTitle: "Member", authorAvatar: null, category: "Science",
      readTime: 2, likes: 0, liked: false, isVerified: false, createdAt: new Date().toISOString(),
      isTrending: false, isFeatured: false, isExpertReviewed: false, reviewRequestStatus: null,
    }));
    await page.route("**/api/articles/8/annotations", (route) => json(route, []));
    await page.route("**/api/articles/8/comments", (route) => json(route, []));
    await page.route("**/api/articles/8/review-request", async (route) => {
      reviewRequests += 1;
      await json(route, { id: 3, articleId: 8, requesterId: 1, status: "pending", reviewerNote: null, createdAt: new Date().toISOString() }, 201);
    });

    await page.goto("/articles/8");
    await page.getByTestId("button-peer-review").click();
    await expect.poll(() => reviewRequests).toBe(1);
  });
  test("a first debate vote is submitted once and immediately becomes the saved stance", async ({ page }) => {
    let voteRequests = 0;
    let leaveRequests = 0;
    let savedVote: "support" | "against" | null = null;
    const debate = {
      id: 12,
      title: "Should evidence guide public policy?",
      description: "A regression fixture for first-time voting.",
      category: "Philosophy",
      supportPercent: 50,
      againstPercent: 50,
      participantCount: 2,
      isLive: true,
      imageUrl: null,
      rank: null,
      isTrending: false,
      isFeatured: false,
      endsAt: null,
      isFrozen: false,
      frozenReason: null,
      isAnonymous: false,
      sourcesRequired: false,
      closingArgMinHours: 0,
      contentWarning: null,
      healthScore: 100,
      mathProblemId: null,
      creatorUserId: "another-user",
      creatorIsModerator: false,
      winnerAuthority: "creator",
      winnerStatus: "undecided",
      endedEarly: false,
      endedAt: null,
      wordLimit: null,
      viewerCount: 1,
    };

    await page.route("**/api/debates/12", (route) => json(route, debate));
    await page.route("**/api/debates/12/outcome", (route) => json(route, null));
    await page.route("**/api/debates/12/my-vote", (route) => json(route, { side: savedVote }));
    await page.route("**/api/debates/12/agreements", (route) => json(route, { canPost: false, agreements: [] }));
    await page.route("**/api/debates/12/leave", async (route) => {
      leaveRequests += 1;
      savedVote = null;
      await json(route, { ...debate, supportPercent: 50, againstPercent: 50, participantCount: 2 });
    });
    await page.route("**/api/debates/12/vote", async (route) => {
      voteRequests += 1;
      const body = route.request().postDataJSON() as { vote: "support" | "against" };
      await new Promise((resolve) => setTimeout(resolve, 100));
      savedVote = body.vote;
      await json(route, { ...debate, supportPercent: 67, againstPercent: 33, participantCount: 3 });
    });

    await page.addInitScript(() => localStorage.removeItem("treffin_first_vote_auth-user"));
    await page.goto("/debates/12");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("treffin_first_vote_auth-user"))).toBeNull();
    const supportButton = page.getByTestId("button-vote-support");
    await expect(supportButton).toBeEnabled();
    await supportButton.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });

    await expect.poll(() => voteRequests).toBe(1);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("treffin_first_vote_auth-user"))).toBe("1");
    await expect(supportButton).toContainText("Supporting");
    await expect(page.getByTestId("button-vote-against")).toBeDisabled();
    await expect(page.getByTestId("first-vote-celebration")).toHaveCount(1);
    await expect(page.getByText("First Vote!", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Dismiss celebration" }).click();
    await expect(page.getByTestId("first-vote-celebration")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("button-vote-support")).toContainText("Supporting");
    await expect(page.getByTestId("first-vote-celebration")).toHaveCount(0);

    await page.getByTestId("button-leave-debate").click();
    await expect.poll(() => leaveRequests).toBe(1);
    await expect(page.getByTestId("button-vote-against")).toBeEnabled();
    await page.getByTestId("button-vote-against").evaluate((button) => (button as HTMLButtonElement).click());
    await expect.poll(() => voteRequests).toBe(2);
    await expect(page.getByTestId("button-vote-against")).toContainText("Opposing");
    await expect(page.getByTestId("first-vote-celebration")).toHaveCount(0);
  });

  test("a closed debate without a published outcome exposes no participation actions", async ({ page }) => {
    let voteRequests = 0;
    const closedDebate = {
      id: 13,
      title: "Should a closed debate still accept votes?",
      description: "A lifecycle regression fixture.",
      category: "Technology",
      supportPercent: 60,
      againstPercent: 40,
      participantCount: 5,
      isLive: false,
      imageUrl: null,
      rank: null,
      isTrending: false,
      isFeatured: false,
      endsAt: new Date(Date.now() - 3_600_000).toISOString(),
      isFrozen: false,
      frozenReason: null,
      isAnonymous: false,
      sourcesRequired: false,
      closingArgMinHours: 0,
      contentWarning: null,
      healthScore: 100,
      mathProblemId: null,
      creatorUserId: "another-user",
      creatorIsModerator: false,
      winnerAuthority: "admin",
      winnerStatus: "pending_admin",
      endedEarly: false,
      endedAt: new Date(Date.now() - 3_600_000).toISOString(),
      wordLimit: null,
      viewerCount: 0,
    };

    await page.route("**/api/debates/13", (route) => json(route, closedDebate));
    await page.route("**/api/debates/13/outcome", (route) => json(route, null));
    await page.route("**/api/debates/13/my-vote", (route) => json(route, { side: null }));
    await page.route("**/api/debates/13/agreements", (route) => json(route, { canPost: false, agreements: [] }));
    await page.route("**/api/debates/13/vote", async (route) => {
      voteRequests += 1;
      await json(route, { error: "This debate is no longer accepting votes" }, 409);
    });

    await page.goto("/debates/13");
    await expect(page.getByText("Voting is closed", { exact: true })).toBeVisible();
    await expect(page.getByTestId("button-vote-support")).toHaveCount(0);
    await expect(page.getByTestId("button-vote-against")).toHaveCount(0);
    await expect(page.getByTestId("button-post-argument")).toHaveCount(0);
    expect(voteRequests).toBe(0);
  });

  test("an existing math solution replaces the create composer with an edit direction", async ({ page, isMobile }) => {
    await page.addInitScript(() => localStorage.setItem("math_user_id", "auth-user"));
    const solution = {
      id: 91,
      problemId: 9,
      userId: "auth-user",
      userName: "Test User",
      userAvatar: null,
      body: "**Step 1:** Use the invariant.\n\n**Final Answer:** $42$",
      approach: "proof",
      isAccepted: false,
      isFeatured: false,
      qualityScore: 0,
      eleganceVotes: 0,
      rigorVotes: 0,
      clarityVotes: 0,
      reactionCounts: {},
      myReactions: [],
      createdAt: new Date().toISOString(),
    };
    await page.route("**/api/math/problems/9", (route) => json(route, {
      id: 9,
      userId: "problem-author",
      userName: "Problem Author",
      userAvatar: null,
      title: "Prove the lifecycle invariant",
      body: "Show that the invariant is preserved.",
      categoryId: 1,
      categoryName: "Algebra",
      categoryColor: "#8b5cf6",
      categoryIcon: "ä",
      difficulty: "intermediate",
      hints: [],
      communityDifficulty: null,
      difficultyVoteCount: 0,
      difficultyDistribution: {},
      myDifficultyVote: null,
      isProblemOfWeek: false,
      isFeatured: false,
      isUnsolved: false,
      status: "open",
      viewCount: 1,
      solutionCount: 1,
      reactionCounts: {},
      myReactions: [],
      solutions: [solution],
      createdAt: new Date().toISOString(),
    }));
    await page.route("**/api/math/problems/9/showdown", (route) => json(route, {
      problemId: 9,
      problemTitle: "Prove the lifecycle invariant",
      solutions: [],
      myVotes: { elegant: null, clear: null, rigorous: null, efficient: null },
    }));

    await page.goto("/math/problem/9");
    await expect(page.getByText("Your solution is already published", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Submit your solution" })).toHaveCount(0);
    await page.getByRole("button", { name: "View my solution" }).click();
    await expect(page.locator("#solution-91")).toBeVisible();
    if (isMobile) await expectNoHorizontalOverflow(page);
  });
  test("article editor isolates drafts by account and uses a contained phone layout", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-project check");
    await page.addInitScript(() => {
      const draft = (title: string) => JSON.stringify({ title, body: "", selectedTags: [], peerReview: false, imageUrl: "", savedAt: Date.now() });
      localStorage.setItem("treffin:article-draft-v2:other-user", draft("Another member's private draft"));
      localStorage.setItem("treffin:article-draft-v2:auth-user", draft("My private draft"));
    });
    await page.goto("/articles/new");
    const titleInput = page.locator('input[placeholder^="Article title"]');
    await expect(titleInput).toHaveValue("My private draft");
    await expect(titleInput).not.toHaveValue("Another member's private draft");
    await titleInput.fill("My updated draft");
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();
    const storedTitle = await page.evaluate(() => {
      const value = localStorage.getItem("treffin:article-draft-v2:auth-user");
      return value ? JSON.parse(value).title : null;
    });
    expect(storedTitle).toBe("My updated draft");
    await expect(page.getByPlaceholder("Article titleâ€¦")).toBeVisible();

    const layout = await page.evaluate(() => {
      const main = document.querySelector("main")?.getBoundingClientRect();
      const aside = document.querySelector("aside")?.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        mainBottom: main?.bottom ?? 0,
        asideTop: aside?.top ?? 0,
      };
    });
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.asideTop).toBeGreaterThanOrEqual(layout.mainBottom - 1);
  });
  test("Elegant Battle records the first vote immediately and remains phone-contained", async ({ page, isMobile }) => {
    let elegantVotes = 0;
    const fullResponse = () => ({
      problemId: 7,
      problemTitle: "Prove that the sample identity is invariant",
      battle: { debateId: 70, isLive: true, isEnded: false, verdict: null, verdictAuthor: null, canParticipate: true, canConclude: false },
      solutions: [
        { id: 11, userId: "author-a", userName: "Ada", approach: "Algebraic", body: "**Step 1:** Expand both sides.\n\n**Step 2:** Cancel equal terms.", steps: ["**Step 1:** Expand both sides.", "**Step 2:** Cancel equal terms."], stepSoundness: [{ up: 0, down: 0 }, { up: 0, down: 0 }], votes: { elegant: elegantVotes, clear: 0, rigorous: 0, efficient: 0 }, isAccepted: false, solvingTime: 90 },
        { id: 12, userId: "author-b", userName: "Emmy", approach: "Geometric", body: "**Step 1:** Construct the symmetry.\n\n**Step 2:** Read the invariant.", steps: ["**Step 1:** Construct the symmetry.", "**Step 2:** Read the invariant."], stepSoundness: [{ up: 0, down: 0 }, { up: 0, down: 0 }], votes: { elegant: 0, clear: 0, rigorous: 0, efficient: 0 }, isAccepted: false, solvingTime: 75 },
      ],
      arguments: [],
      myAxisVotes: { elegant: elegantVotes ? 11 : null, clear: null, rigorous: null, efficient: null },
      categories: { mostElegant: elegantVotes ? { solutionId: 11, votes: elegantVotes } : null, mostRigorous: null, clearest: null, mostEfficient: null },
    });
    await page.route("**/api/math/problems/7/elegance-battle/full", (route) => json(route, fullResponse()));
    await page.route("**/api/math/problems/7/showdown/vote", async (route) => {
      elegantVotes = 1;
      return json(route, {
        problemId: 7,
        problemTitle: fullResponse().problemTitle,
        solutions: fullResponse().solutions.map((solution) => ({
          id: solution.id,
          userId: solution.userId,
          userName: solution.userName,
          userAvatar: null,
          body: solution.body,
          approach: solution.approach,
          stepCount: solution.steps.length,
          isFastest: solution.id === 12,
          solvingTime: solution.solvingTime,
          votes: solution.votes,
        })),
        myVotes: { elegant: 11, clear: null, rigorous: null, efficient: null },
      });
    });

    await page.goto("/math/problem/7/elegance-battle");
    await expect(page.getByText("ELEGANCE BATTLE", { exact: true })).toBeVisible();
    const elegantButton = page.getByRole("button", { name: /Elegant/i }).first();
    await elegantButton.click();
    await expect(elegantButton).toContainText("1");

    if (isMobile) {
      await expectNoHorizontalOverflow(page);
      await page.getByRole("button", { name: /0 notes/i }).first().click();
      const composer = page.getByPlaceholder(/Annotate your take/i);
      await expect(composer).toBeVisible();
      await expect.poll(() => composer.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= -1 && rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1;
      })).toBe(true);
    }
  });
});
