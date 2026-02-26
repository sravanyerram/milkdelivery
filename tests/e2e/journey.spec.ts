import { test, expect } from '@playwright/test';

// Use a unique email per run to avoid "user already exists" issues across test runs
const uniqueId = Date.now();
const clientName = `E2E Client ${uniqueId}`;
const clientEmail = `client${uniqueId}@test.com`;
const clientPass = 'password123';

const adminEmail = 'sravan.yerram1988@gmail.com';
const adminPass = 'password123';

test('Full Multi-Role User Journey', async ({ browser }) => {
    // 1. Create two isolated browser contexts for Client and Admin, with video recording enabled
    const clientContext = await browser.newContext({ recordVideo: { dir: 'test-results/videos/client/' } });
    const adminContext = await browser.newContext({ recordVideo: { dir: 'test-results/videos/admin/' } });

    const clientPage = await clientContext.newPage();
    const adminPage = await adminContext.newPage();

    clientPage.on('console', msg => console.log('CLIENT LOG:', msg.text()));
    clientPage.on('pageerror', err => console.log('CLIENT ERR:', err.message));
    adminPage.on('console', msg => console.log('ADMIN LOG:', msg.text()));
    adminPage.on('pageerror', err => console.log('ADMIN ERR:', err.message));

    // =========================================================================
    // STEP 1 & 2: Client Signup & Pending Approval Screen
    // =========================================================================
    await test.step('Client signs up and sees pending screen', async () => {
        await clientPage.goto('http://localhost:3000/login');
        await clientPage.waitForLoadState('networkidle');

        await clientPage.getByRole('button', { name: 'Sign Up', exact: true }).click();

        await clientPage.fill('input[placeholder="Full name"]', clientName);
        await clientPage.fill('input[placeholder="Email address"]', clientEmail);
        await clientPage.fill('input[placeholder="Password"]', clientPass);

        await clientPage.getByRole('button', { name: 'Create Account' }).click();

        // Assert it redirects to pending
        await clientPage.waitForURL(/.*\/pending/, { timeout: 10000 });
        await expect(clientPage.locator('text=Account Pending Approval')).toBeVisible();
    });

    // =========================================================================
    // STEP 3: Admin logs in and approves client
    // =========================================================================
    await test.step('Admin logs in and approves client', async () => {
        await adminPage.goto('http://localhost:3000/login');

        await adminPage.fill('input[placeholder="Email address"]', adminEmail);
        await adminPage.fill('input[placeholder="Password"]', adminPass);
        await adminPage.getByRole('button', { name: 'Sign In with Email' }).click();

        // The admin should either log in successfully, or fail if they don't exist yet (fresh emulator).
        try {
            await adminPage.waitForURL(/.*\/admin\/dashboard/, { timeout: 5000 });
        } catch {
            // If login failed (e.g. Firebase emulator wiped), sign up the admin
            await adminPage.getByRole('button', { name: 'Sign Up', exact: true }).click();
            await adminPage.fill('input[placeholder="Full name"]', 'Admin User');
            await adminPage.fill('input[placeholder="Email address"]', adminEmail);
            await adminPage.fill('input[placeholder="Password"]', adminPass);
            await adminPage.getByRole('button', { name: 'Create Account' }).click();
            await adminPage.waitForURL(/.*\/admin\/dashboard/, { timeout: 10000 });
        }

        // Navigate to users awaiting approval
        await adminPage.click('text=new user'); // link says "X new users awaiting approval"
        await adminPage.waitForURL(/.*\/admin\/users/);

        // Find the row with clientName and click "Approve"
        const clientRow = adminPage.locator('div').filter({ hasText: clientName });
        await clientRow.getByRole('button', { name: 'Approve' }).click();

        // Wait for "Approve" button to disappear, meaning it was approved
        await expect(clientRow.getByRole('button', { name: 'Approve' })).not.toBeVisible();
    });

    // =========================================================================
    // STEP 4: Client gets approved and accesses home page with default 1L buffalo
    // =========================================================================
    await test.step('Client accesses home page and sees default 1L Buffalo', async () => {
        // Since Client role updated, click the Refresh Status button to fetch fresh UserDoc
        await clientPage.waitForTimeout(1000); // Give firestore a tiny buffer
        await clientPage.getByRole('button', { name: /Refresh Status/i }).click();

        await clientPage.waitForURL(/.*\/client\/dashboard/, { timeout: 15000 });

        // Assert home page is launched with user details on top
        await expect(clientPage.locator(`text=${clientName}`)).toBeVisible();

        // Assert default is set to 1L Buffalo
        await expect(clientPage.locator('text=Default: 1.0L Buffalo')).toBeVisible();
    });

    // =========================================================================
    // STEP 5: Client requests milk for current date and future dates
    // =========================================================================
    await test.step('Client requests milk for current date and tomorrow', async () => {
        const todayUrl = clientPage.url();

        // Wait for the calendar to render days
        await clientPage.waitForSelector('.grid-cols-7 button');

        const todayStr = new Date().getDate().toString();
        // Click today
        await clientPage.getByRole('button', { name: todayStr, exact: true }).first().click();

        // Log Delivery (Default is already Buffalo 1L)
        // Wait for modal to render
        await clientPage.waitForSelector('text=Milk Type');
        await clientPage.getByRole('button', { name: 'Log Delivery' }).click();

        // The modal component auto-closes after 1.2s. Let's just wait for the modal to disappear.
        await expect(clientPage.getByRole('button', { name: 'Log Delivery' })).not.toBeVisible({ timeout: 5000 });

        // Tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.getDate().toString();

        // Wait for calendar to be active again
        await clientPage.getByRole('button', { name: tomorrowStr, exact: true }).first().click();

        await clientPage.waitForSelector('text=Milk Type');
        await clientPage.getByRole('button', { name: 'Log Delivery' }).click();
        await expect(clientPage.getByRole('button', { name: 'Log Delivery' })).not.toBeVisible({ timeout: 5000 });
    });

    // =========================================================================
    // STEP 6: Admin sees revenue and navigates to reports to check capacity
    // =========================================================================
    await test.step('Admin checks revenue and capacity report', async () => {
        // Go back to dashboard to refresh revenue
        await adminPage.locator('a[href="/admin/dashboard"]').first().click();

        // Check that some revenue exists now (client ordered milk)
        // Litres should be > 0. The UI shows Total Delivered "X L"
        // Wait for data to load
        await adminPage.waitForTimeout(1000); // give firestore a sec

        // Ensure "Total Delivered" is visible
        await expect(adminPage.locator('text=Total Delivered')).toBeVisible();

        // Navigates to report
        await adminPage.locator('a[href="/admin/reports"]').first().click();

        // Verify we are on procurement report page looking at capacity
        await expect(adminPage.locator('text=Procurement Report')).toBeVisible();

        // Verify capacity cap is visible (e.g. "30L cap")
        await expect(adminPage.getByRole('button', { name: /cap/i })).toBeVisible();

        // Our new client should be in the breakdown list since they have an expected amount
        await expect(adminPage.locator(`text=${clientName}`)).toBeVisible();
    });
});
