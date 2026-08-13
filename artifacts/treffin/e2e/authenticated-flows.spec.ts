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
      return json(route, { id: 1, betterAuthId: "auth-user", name: "Test User", title: "Member", bio: "Stored bio", avatarUrl: null, interests: ["Philosophy", "Science", "History"], reputation: 12, followers: 0, following: 0, articlesPublished: 0 });
    }
    if (path === "/api/users/me" && request.method() === "PUT") return json(route, { ok: true, id: 1 });
    if (path === "/api/users/me/interests" && request.method() === "PATCH") return json(route, { ok: true });
    if (path === "/api/reputation") return json(route, { total: 12, breakdown: { debates: 2, articles: 2, community: 2, votes: 2, posts: 4 }, recentEvents: [] });
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
  test("profile renders database data and persists through the authenticated user API", async ({ page }) => {
    let updateBody: string | null = null;
    await page.route("**/api/users/me", async (route) => {
      if (route.request().method() === "PUT") {
        updateBody = route.request().postData();
        return json(route, { ok: true, id: 1 });
      }
      return json(route, { id: 1, betterAuthId: "auth-user", name: "Test User", title: "Member", bio: "Stored bio", avatarUrl: null, interests: ["Philosophy", "Science", "History"], reputation: 12, followers: 0, following: 0, articlesPublished: 0 });
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
  test("article editor uses a single-column phone layout without horizontal overflow", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-project check");
    await page.goto("/articles/new");
    await expect(page.getByPlaceholder("Article title…")).toBeVisible();

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
});