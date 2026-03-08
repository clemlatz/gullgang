import { test, expect } from '@playwright/test';

test('user can create a game', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Create a game/i }).click();

  await page.getByPlaceholder('Your name').fill('Alice');
  await page.getByRole('button', { name: /^Create$/i }).click();

  await expect(page).toHaveURL(/\/game\/[A-Z0-9]{6}/);
  await expect(page.getByText(/Players \(1\/8\)/)).toBeVisible();
  await expect(page.getByText('Alice')).toBeVisible();
});

test('user can join a game via its URL', async ({ page, request }) => {
  const response = await request.post('/api/games', {
    data: { name: 'Alice' },
  });
  const { code } = await response.json();

  await page.goto(`/game/${code}`);

  await expect(page.getByRole('heading', { name: /Join a game/i })).toBeVisible();

  await page.getByPlaceholder('Your name').fill('Bob');
  await page.getByRole('button', { name: /^Join$/i }).click();

  await expect(page).toHaveURL(`/game/${code}`);
  await expect(page.getByText(/Players \(2\/8\)/)).toBeVisible();
  await expect(page.getByText('Bob')).toBeVisible();
});
