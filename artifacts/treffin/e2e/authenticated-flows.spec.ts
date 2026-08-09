import { expect, test, type Page, type Route } from "@playwright/test";

const session = {
  session: { id: "session-1", userId: "auth-user", token: "test-token", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  user: { id: "auth-user", name: "Test User", email: "test@example.invalid", image: null },
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
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
  test.beforeEach(async ({ page }) => mockAuthenticatedApi(page));

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
      content: "Article body",
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