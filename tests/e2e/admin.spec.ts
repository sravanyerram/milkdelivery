import { test, expect } from '@playwright/test';

test.describe('Admin Experience Mock UI Tests', () => {

    test('can access admin login page and see the login form', async ({ page }) => {
        await page.goto('http://localhost:3000/login');

        // Assure we can see the app logo/name
        await expect(page.locator('text=milkdelivery')).toBeVisible();

        // Admin login fields exist
        await expect(page.locator('input[placeholder="Email address"]')).toBeVisible();
        await expect(page.locator('input[placeholder="Password"]')).toBeVisible();
        await expect(page.locator('button', { hasText: 'Sign In with Email' })).toBeVisible();
    });

    test('admin routing protection redirects to login', async ({ page }) => {
        // Without auth, hitting admin/dashboard should redirect to login
        await page.goto('http://localhost:3000/admin/dashboard');

        await expect(page).toHaveURL(/.*\/login/);
    });

});
