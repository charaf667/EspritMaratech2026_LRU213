import { test, expect } from "@playwright/test";

const API = "http://localhost:8000";
const ADMIN_EMAIL = "admin@omnia.org";
const AGENT_EMAIL = "sara@omnia.org";
const PASSWORD = "dev12345";

// ─── Helper: login via API and inject cookies ──────────────

async function apiLogin(page: import("@playwright/test").Page, email: string) {
  // 1. Get CSRF token
  const csrfRes = await page.request.get(`${API}/api/auth/csrf/`, {
    headers: { Accept: "application/json" },
  });
  expect(csrfRes.ok()).toBe(true);

  // Extract csrftoken from response cookies
  const cookies = await page.context().cookies(API);
  const csrfCookie = cookies.find((c) => c.name === "csrftoken");
  expect(csrfCookie).toBeTruthy();

  // 2. Login
  const loginRes = await page.request.post(`${API}/api/auth/login/`, {
    data: { email, password: PASSWORD },
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfCookie!.value,
    },
  });
  expect(loginRes.ok()).toBe(true);
  return loginRes.json();
}

// Helper: login via UI
async function uiLogin(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app", { timeout: 10000 });
}

// ═══════════════════════════════════════════════════════════
//  1. LOGIN FLOW
// ═══════════════════════════════════════════════════════════

test.describe("Login", () => {
  test("shows login form on /login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("rejects wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "wrong@test.com");
    await page.fill('input[name="password"]', "wrongpass");
    await page.click('button[type="submit"]');
    // Use specific selector to avoid Next.js route announcer
    await expect(
      page.locator('p[role="alert"]')
    ).toBeVisible({ timeout: 5000 });
  });

  test("logs in admin and redirects to /app", async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL);
    expect(page.url()).toContain("/app");
  });

  test("logs in agent and redirects to /app", async ({ page }) => {
    await uiLogin(page, AGENT_EMAIL);
    expect(page.url()).toContain("/app");
  });
});

// ═══════════════════════════════════════════════════════════
//  2. SESSION PERSISTENCE (refresh survives)
// ═══════════════════════════════════════════════════════════

test.describe("Session persistence", () => {
  test("session survives page refresh", async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL);

    // Refresh the page
    await page.reload();

    // Wait for session restore (apiGetMe call)
    await page.waitForTimeout(4000);

    // Should still be on /app (not redirected to /login)
    expect(page.url()).toContain("/app");
  });

  test("CSRF token works after session restore (can POST)", async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL);

    // Reload page (session restore path)
    await page.reload();
    await page.waitForTimeout(4000);

    // Verify CSRF cookie exists (set during session restore)
    const allCookies = await page.context().cookies();
    const csrfCookie = allCookies.find((c) => c.name === "csrftoken");
    expect(csrfCookie).toBeTruthy();

    // Verify we can make an API POST with the CSRF token
    const logoutRes = await page.request.post(`${API}/api/auth/logout/`, {
      headers: { "X-CSRFToken": csrfCookie!.value },
    });
    expect(logoutRes.ok()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
//  3. LOGOUT
// ═══════════════════════════════════════════════════════════

test.describe("Logout", () => {
  test("logout redirects to /login", async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL);

    // Find the logout button by its aria-label (supports FR/AR/TN)
    const logoutButton = page.locator(
      '[aria-label*="éconnexion"], [aria-label*="logout"], [aria-label*="تسجيل"], [aria-label*="خروج"]'
    );
    await logoutButton.first().click();

    await page.waitForURL("**/login", { timeout: 5000 });
    expect(page.url()).toContain("/login");
  });

  test("after logout, /app redirects to /login", async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL);

    const logoutButton = page.locator(
      '[aria-label*="éconnexion"], [aria-label*="logout"], [aria-label*="تسجيل"], [aria-label*="خروج"]'
    );
    await logoutButton.first().click();
    await page.waitForURL("**/login", { timeout: 5000 });

    // Try to go to /app directly
    await page.goto("/app");
    await page.waitForTimeout(4000);
    expect(page.url()).toContain("/login");
  });
});

// ═══════════════════════════════════════════════════════════
//  4. PROTECTED ROUTES
// ═══════════════════════════════════════════════════════════

test.describe("Protected routes", () => {
  test("/app redirects to /login when not authenticated", async ({ page }) => {
    await page.goto("/app");
    await page.waitForTimeout(4000);
    expect(page.url()).toContain("/login");
  });

  test("/app/admin redirects to /login when not authenticated", async ({ page }) => {
    await page.goto("/app/admin");
    await page.waitForTimeout(4000);
    expect(page.url()).toContain("/login");
  });

  test("/app/new-visit redirects to /login when not authenticated", async ({ page }) => {
    await page.goto("/app/new-visit");
    await page.waitForTimeout(4000);
    expect(page.url()).toContain("/login");
  });

  test("/field redirects to /login when not authenticated", async ({ page }) => {
    await page.goto("/field");
    await page.waitForTimeout(4000);
    expect(page.url()).toContain("/login");
  });

  test("/offline redirects to /login when not authenticated", async ({ page }) => {
    await page.goto("/offline");
    await page.waitForTimeout(4000);
    expect(page.url()).toContain("/login");
  });
});

// ═══════════════════════════════════════════════════════════
//  5. PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════

test.describe("Public routes", () => {
  test("/feeling is accessible without auth", async ({ page }) => {
    await page.goto("/feeling");
    await page.waitForTimeout(1000);
    expect(page.url()).toContain("/feeling");
  });

  test("/login is accessible without auth", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(1000);
    expect(page.url()).toContain("/login");
  });
});

// ═══════════════════════════════════════════════════════════
//  6. RBAC (admin vs agent)
// ═══════════════════════════════════════════════════════════

test.describe("RBAC", () => {
  test("admin sees admin tab", async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL);

    const adminTab = page
      .locator("text=Admin")
      .or(page.locator("text=Tableau de bord"))
      .or(page.locator("text=لوحة"));
    await expect(adminTab.first()).toBeVisible({ timeout: 5000 });
  });

  test("agent does NOT see admin tab", async ({ page }) => {
    await uiLogin(page, AGENT_EMAIL);
    await page.waitForTimeout(2000);
    const adminTab = page.locator('[id="admin"]');
    await expect(adminTab).toHaveCount(0);
  });
});

// ═══════════════════════════════════════════════════════════
//  7. COOKIE SECURITY
// ═══════════════════════════════════════════════════════════

test.describe("Cookie security", () => {
  test("session cookie is httpOnly and SameSite=Lax", async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL);

    // Cookies are set on localhost (API domain)
    const allCookies = await page.context().cookies();
    const sessionCookie = allCookies.find((c) => c.name === "sessionid");
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie!.httpOnly).toBe(true);
    expect(sessionCookie!.sameSite).toBe("Lax");
  });

  test("csrf cookie is NOT httpOnly (JS needs to read it)", async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL);

    const allCookies = await page.context().cookies();
    const csrfCookie = allCookies.find((c) => c.name === "csrftoken");
    expect(csrfCookie).toBeTruthy();
    expect(csrfCookie!.httpOnly).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
//  8. API AUTH ENDPOINTS
// ═══════════════════════════════════════════════════════════

test.describe("API auth endpoints", () => {
  test("GET /api/auth/csrf/ returns csrfToken", async ({ request }) => {
    const res = await request.get(`${API}/api/auth/csrf/`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.csrfToken).toBeTruthy();
  });

  test("GET /api/auth/me/ returns 401 or 403 when not logged in", async ({ request }) => {
    const res = await request.get(`${API}/api/auth/me/`);
    // DRF SessionAuthentication returns 403 for unauthenticated requests
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/auth/login/ with valid creds returns user", async ({ page }) => {
    const user = await apiLogin(page, ADMIN_EMAIL);
    expect(user.email).toBe(ADMIN_EMAIL);
    expect(user.role).toBe("admin");
  });

  test("POST /api/auth/login/ with invalid creds returns 401", async ({ page }) => {
    await page.request.get(`${API}/api/auth/csrf/`);
    const cookies = await page.context().cookies(API);
    const csrfCookie = cookies.find((c) => c.name === "csrftoken");

    const res = await page.request.post(`${API}/api/auth/login/`, {
      data: { email: "bad@test.com", password: "wrong" },
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfCookie!.value,
      },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/auth/me/ returns user after login", async ({ page }) => {
    await apiLogin(page, AGENT_EMAIL);
    const meRes = await page.request.get(`${API}/api/auth/me/`);
    expect(meRes.ok()).toBe(true);
    const me = await meRes.json();
    expect(me.email).toBe(AGENT_EMAIL);
    expect(me.role).toBe("agent");
  });

  test("POST /api/auth/logout/ invalidates session", async ({ page }) => {
    await apiLogin(page, ADMIN_EMAIL);

    const cookies = await page.context().cookies(API);
    const csrfCookie = cookies.find((c) => c.name === "csrftoken");
    const logoutRes = await page.request.post(`${API}/api/auth/logout/`, {
      headers: { "X-CSRFToken": csrfCookie!.value },
    });
    expect(logoutRes.ok()).toBe(true);

    // /me should now fail (DRF returns 403 for SessionAuth)
    const meRes = await page.request.get(`${API}/api/auth/me/`);
    expect([401, 403]).toContain(meRes.status());
  });

  test("GET /api/users/ is admin-only (agent gets 403)", async ({ page }) => {
    await apiLogin(page, AGENT_EMAIL);
    const res = await page.request.get(`${API}/api/auth/users/`);
    expect(res.status()).toBe(403);
  });

  test("GET /api/users/ works for admin", async ({ page }) => {
    await apiLogin(page, ADMIN_EMAIL);
    const res = await page.request.get(`${API}/api/auth/users/`);
    expect(res.ok()).toBe(true);
    const users = await res.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════
//  9. ALREADY LOGGED IN → REDIRECT FROM LOGIN
// ═══════════════════════════════════════════════════════════

test.describe("Already authenticated", () => {
  test("visiting /login when already logged in redirects to /app", async ({ page }) => {
    // Login via UI fresh (isolated context per test)
    await page.goto("/login");
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/app", { timeout: 15000 });

    // Now navigate to /login — should redirect back to /app
    await page.goto("/login");
    await page.waitForTimeout(5000);
    expect(page.url()).toContain("/app");
  });
});
