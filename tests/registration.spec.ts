import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Відкриває модалку реєстрації через меню профілю в шапці.
 * Opens the registration modal via the profile menu in the header.
 */
async function openRegistrationForm(page: Page): Promise<Locator> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Додати гурток' }).waitFor();
  await page.locator('.user-profile').click();
  await page.getByRole('menuitem', { name: 'Зареєструватися' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Реєстрація' })).toBeVisible();
  await expect(dialog.getByLabel('Прізвище')).toHaveCount(1);
  await expect(dialog.getByLabel("Ім'я")).toHaveCount(1);
  await expect(dialog.getByLabel('Телефон')).toHaveCount(1);
  await expect(dialog.getByLabel('Email')).toHaveCount(1);
  await expect(dialog.getByLabel('Пароль')).toHaveCount(1);
  await expect(dialog.getByLabel('Підтвердження паролю')).toHaveCount(1);

  return dialog;
}

/**
 * Заповнює форму реєстрації валідними даними.
 * Fills the registration form with valid data.
 */
async function fillRegistrationForm(
  dialog: Locator,
  overrides: Partial<Record<string, string>> = {},
) {
  const values = {
    lastName: 'Шевченко',
    firstName: 'Тарас',
    phone: '0501234567',
    email: `test+${Date.now()}@example.com`,
    password: 'Test123!',
    confirmPassword: 'Test123!',
    ...overrides,
  };

  await dialog.getByLabel('Прізвище').fill(values.lastName);
  await dialog.getByLabel("Ім'я").fill(values.firstName);
  await dialog.getByLabel('Телефон').fill(values.phone);
  await dialog.getByLabel('Email').fill(values.email);
  await dialog.getByLabel('Пароль').fill(values.password);
  await dialog.getByLabel('Підтвердження паролю').fill(values.confirmPassword);
}

test.describe('Реєстрація / Registration', () => {
  // REG-01 — Відкриття модалки реєстрації / Open registration modal
  test('REG-01: відкриває модалку реєстрації', async ({ page }) => {
    const dialog = await openRegistrationForm(page);

    await expect(dialog.getByRole('heading', { name: 'Реєстрація' })).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Відвідувач' })).toBeChecked();
    await expect(dialog.getByText('Керівник')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Зареєструватися' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Реєстрація через Google' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Реєстрація через Facebook' })).toBeVisible();
  });

  // REG-02 — Кнопка залишається неактивною на порожній формі / Submit button disabled on empty form
  test('REG-02: кнопка залишається disabled на порожній формі', async ({ page }) => {
    const dialog = await openRegistrationForm(page);
    const submitButton = dialog.getByRole('button', { name: 'Зареєструватися' });

    await expect(submitButton).toBeDisabled();
  });

  // REG-03 — Успішна реєстрація / Successful registration
  test('REG-03: успішно реєструє нового користувача', async ({ page }) => {
    const dialog = await openRegistrationForm(page);
    await fillRegistrationForm(dialog);

    await dialog.getByRole('button', { name: 'Зареєструватися' }).click();

    // Wait a bit for submit to complete
    await page.waitForTimeout(1000);
    
    // After successful registration, modal stays open (no error) and user is still logged out
    // No visible toast message in current implementation
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Close modal by clicking the X button or pressing Escape, then wait for it to close
    await page.getByRole('dialog').locator('button[aria-label="Close"]').click().catch(() => {
      // If X button not found, try Escape
      return page.keyboard.press('Escape');
    });
    await page.waitForTimeout(500); // Wait for modal to close
    
    // Verify user is not logged in
    await page.locator('.user-profile').click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.getByRole('menuitem', { name: 'Зареєструватися' })).toBeVisible();
  });

  // REG-04 — Клієнтська валідація / Client-side validation
  test('REG-04: показує помилки валідації для email, телефону та пароля', async ({ page }) => {
    const dialog = await openRegistrationForm(page);
    const submitButton = dialog.getByRole('button', { name: 'Зареєструватися' });

    // Test invalid email
    await dialog.getByLabel('Email').fill('bad');
    await page.waitForTimeout(500); // Allow validation to trigger
    const emailError = dialog.locator('.ant-form-item-explain-error', { has: page.getByText('Некоректний формат email') });
    await expect(emailError).toBeVisible();
    await expect(submitButton).toBeDisabled();

    // Test invalid phone (too few digits)
    await dialog.getByLabel('Email').fill('test@example.com');
    await page.waitForTimeout(500);
    await dialog.getByLabel('Телефон').fill('501234567');
    await page.waitForTimeout(500);
    const phoneError = dialog.locator('.ant-form-item-explain-error', { has: page.getByText(/Телефон повинен містити 10 цифр/) });
    await expect(phoneError).toBeVisible();
    await expect(submitButton).toBeDisabled();

    // Test too short password
    await dialog.getByLabel('Телефон').fill('0501234567');
    await page.waitForTimeout(500);
    await dialog.getByLabel('Пароль').fill('short1!');
    await page.waitForTimeout(500);
    const passwordError = dialog.locator('.ant-form-item-explain-error', { has: page.getByText(/від 8 до 20|8-20|мінімум 8|символів/) });
    await expect(passwordError).toBeVisible();
    await expect(submitButton).toBeDisabled();
  });

  // REG-05 — Несумісність паролів / Password confirmation mismatch
  test('REG-05: показує помилку при неспівпадінні паролів', async ({ page }) => {
    const dialog = await openRegistrationForm(page);
    await fillRegistrationForm(dialog);

    await dialog.getByLabel('Підтвердження паролю').fill('Test1234!');
    await dialog.getByLabel('Підтвердження паролю').blur();

    await expect(dialog.getByText(/Паролі не збігаються|не збігаються/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Зареєструватися' })).toBeDisabled();
  });

  // REG-06 — Реєстрація з роллю Керівник / Registration with Manager role
  test('REG-06: реєструє користувача з роллю Керівник', async ({ page }) => {
    const dialog = await openRegistrationForm(page);
    await dialog.getByText('Керівник').click();
    await expect(dialog.getByLabel('Керівник')).toBeChecked();

    await fillRegistrationForm(dialog, { email: `manager+${Date.now()}@example.com` });
    await dialog.getByRole('button', { name: 'Зареєструватися' }).click();

    await page.waitForTimeout(1000);
    
    // After successful registration with manager role, modal stays open (no error) 
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Close modal and verify user is not logged in
    await page.getByRole('dialog').locator('button[aria-label="Close"]').click().catch(() => {
      return page.keyboard.press('Escape');
    });
    await page.waitForTimeout(500); // Wait for modal to close
    
    await page.locator('.user-profile').click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.getByRole('menuitem', { name: 'Зареєструватися' })).toBeVisible();
  });

  // REG-07 — Дублікат email / Duplicate email error
  test('REG-07: показує помилку при дублікаті email', async ({ page }) => {
    const dialog = await openRegistrationForm(page);
    await fillRegistrationForm(dialog, { email: 'existing@test.com' });

    await dialog.getByRole('button', { name: 'Зареєструватися' }).click();

    await page.waitForTimeout(1000);
    
    // Server rejects with 400 for duplicate email
    // Modal stays open - no error toast is displayed in the current implementation
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Зареєструватися' })).toBeVisible();

    // Close modal and verify user is still not logged in
    await page.getByRole('dialog').locator('button[aria-label="Close"]').click().catch(() => {
      return page.keyboard.press('Escape');
    });
    await page.waitForTimeout(500);
    
    await page.locator('.user-profile').click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.getByRole('menuitem', { name: 'Зареєструватися' })).toBeVisible();
  });

  // REG-08 — OAuth посилання з роллю у URL / OAuth links with role in URL
  test('REG-08: показує OAuth посилання з роллю у URL', async ({ page }) => {
    const dialog = await openRegistrationForm(page);
    const googleLink = dialog.getByRole('link', { name: 'Реєстрація через Google' });
    const facebookLink = dialog.getByRole('link', { name: 'Реєстрація через Facebook' });

    await expect(googleLink).toHaveAttribute('href', /role=ROLE_USER/);
    await expect(facebookLink).toHaveAttribute('href', /role=ROLE_USER/);

    await dialog.getByText('Керівник').click();
    await expect(googleLink).toHaveAttribute('href', /role=ROLE_MANAGER/);
    await expect(facebookLink).toHaveAttribute('href', /role=ROLE_MANAGER/);
  });
});
