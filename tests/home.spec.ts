import { test, expect } from '@playwright/test';

test('home page is correctly displayed', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Gang de Mouettes');
  await expect(page.getByRole('heading', { name: 'Gull Gang' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Create a game/i })).toBeVisible();
});
