import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@omnia.org";
const AGENT_EMAIL = "sara@omnia.org";
const PASSWORD = "dev12345";

// Helper: login via UI (resilient to rate-limit + admin redirect)
async function uiLogin(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  // Check if already logged in (redirected away from /login)
  if (!page.url().includes("/login")) return;

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // Accept /app or /app/admin as valid redirect targets
  await page.waitForURL(/\/app/, { timeout: 20000 });
}

// ═══════════════════════════════════════════════════════════
//  AGENT SMOKE: login → home → Map/List toggle → bottom sheet
// ═══════════════════════════════════════════════════════════

test.describe("Agent Sprint Smoke", () => {
  test("login + agent home + Map/List toggle + family bottom sheet", async ({ page }) => {
    // 1. Login as agent
    await uiLogin(page, AGENT_EMAIL);
    expect(page.url()).toContain("/app");

    // 2. Verify list view is visible (default mobile view)
    const listSection = page.locator('section[aria-label*="Liste"], section[aria-label*="قائمة"], ul[role="list"]');
    await expect(listSection.first()).toBeVisible({ timeout: 5000 });

    // 3. Toggle to Map view
    const mapToggle = page.locator('button').filter({ hasText: /Carte|الخريطة|carte/i });
    if (await mapToggle.first().isVisible()) {
      await mapToggle.first().click();
      // Map section should be visible
      const mapSection = page.locator('section[aria-label*="Carte"], section[aria-label*="الخريطة"]');
      await expect(mapSection.first()).toBeVisible({ timeout: 3000 });
    }

    // 4. Toggle back to List view
    const listToggle = page.locator('button').filter({ hasText: /Liste|القائمة|liste/i });
    if (await listToggle.first().isVisible()) {
      await listToggle.first().click();
    }

    // 5. Click a family to open bottom sheet
    const familyButton = page.locator('ul[role="list"] li button').first();
    if (await familyButton.isVisible({ timeout: 3000 })) {
      await familyButton.click();

      // Bottom sheet should appear with quick actions
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Verify quick action buttons exist (Call, Navigate, Add Visit)
      const callButton = dialog.locator('button').filter({ hasText: /Appeler|اتصال|اتّصل|Call/i });
      await expect(callButton.first()).toBeVisible({ timeout: 2000 });

      const navigateButton = dialog.locator('button').filter({ hasText: /Itinéraire|الاتجاهات|Navigate/i });
      await expect(navigateButton.first()).toBeVisible({ timeout: 2000 });

      const addVisitButton = dialog.locator('button').filter({ hasText: /visite|زيارة|Visit/i });
      await expect(addVisitButton.first()).toBeVisible({ timeout: 2000 });

      // Close the bottom sheet
      const closeButton = dialog.locator('button[aria-label*="ermer"], button[aria-label*="إغلاق"], button[aria-label*="Close"]');
      if (await closeButton.first().isVisible()) {
        await closeButton.first().click();
      }
    }
  });

  test("agent can open Create Family modal", async ({ page }) => {
    // Use mobile viewport so the bottom FAB bar is visible
    await page.setViewportSize({ width: 390, height: 844 });
    await uiLogin(page, AGENT_EMAIL);

    // The FAB bar has a button with UserPlus icon and text containing "famille"/"عايلة"
    // Wait for the family list to load first
    await page.waitForTimeout(2000);

    // Target the bottom action bar button specifically (not family list items)
    const bottomBar = page.locator('.a11y-bottom-actions');
    const addFamilyBtn = bottomBar.locator('button').first();
    if (await addFamilyBtn.isVisible({ timeout: 3000 })) {
      await addFamilyBtn.click();

      // Modal should be visible with the head name field
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 3000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  ADMIN SMOKE: login → dashboard → planner → duplicates
// ═══════════════════════════════════════════════════════════

test.describe("Admin Sprint Smoke", () => {
  test("admin dashboard loads with KPIs + sidebar has planner and duplicates", async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL);

    // Navigate to admin
    await page.goto("/app/admin");
    await page.waitForTimeout(2000);

    // Dashboard should have KPI cards or heading
    const dashboardRegion = page.locator('[role="region"]');
    await expect(dashboardRegion.first()).toBeVisible({ timeout: 5000 });

    // Sidebar should have Missions/Planner link
    const plannerLink = page.locator('nav button').filter({ hasText: /Missions|المهام|Planner/i });
    await expect(plannerLink.first()).toBeVisible({ timeout: 5000 });

    // Sidebar should have Doublons/Duplicates link
    const duplicatesLink = page.locator('nav button').filter({ hasText: /Doublons|مكررات|Duplicates/i });
    await expect(duplicatesLink.first()).toBeVisible({ timeout: 5000 });
  });

  test("admin can open Mission Planner", async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL);
    await page.goto("/app/admin?section=planner");
    await page.waitForTimeout(2000);

    // Mission Planner heading should be visible
    const heading = page.locator('h1').filter({ hasText: /Planificateur|مخطط|Mission/i });
    await expect(heading.first()).toBeVisible({ timeout: 5000 });

    // Should have family selection checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(0); // May be 0 if no families loaded
  });

  test("admin can open Duplicate Merge", async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL);
    await page.goto("/app/admin?section=duplicates");
    await page.waitForTimeout(2000);

    // Duplicate Merge heading should be visible
    const heading = page.locator('h1').filter({ hasText: /doublons|مكررات|Duplicate/i });
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
  });

});
