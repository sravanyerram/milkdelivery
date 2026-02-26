import { test, expect } from '@playwright/test';

test.describe('Client Experience Mock UI Tests', () => {

    test('can access login page and switch to Sign Up', async ({ page }) => {
        await page.goto('http://localhost:3000/login');

        // Check mode tabs
        await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

        // Should show name field after switching to sign up
        await expect(page.locator('input[placeholder="Full name"]')).toBeVisible();
        await expect(page.locator('button', { hasText: 'Create Account' })).toBeVisible();
    });

    test('client routing protection redirects to login', async ({ page }) => {
        // Without auth, hitting client/dashboard should redirect to login
        await page.goto('http://localhost:3000/client/dashboard');

        await expect(page).toHaveURL(/.*\/login/);
    });

});
