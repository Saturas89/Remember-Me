import { test, expect, type Page } from '@playwright/test';

// Helper to complete onboarding since reminder settings are in profile
async function completeOnboarding(page: Page) {
  await page.goto('/');
  
  // Navigate through onboarding if needed
  const startButton = page.getByTestId('start-button');
  if (await startButton.isVisible()) {
    await startButton.click();
  }
  
  // Complete any required onboarding steps to reach profile
  // This implementation will depend on existing app structure
}

test.describe('Notification Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should show reminder settings card in profile', async ({ page }) => {
    await completeOnboarding(page);
    
    // Navigate to profile tab - based on expected app structure
    await page.getByRole('tab', { name: /profil/i }).click();
    
    // Should show reminder settings card per spec FR-16.10
    const reminderSettings = page.getByTestId('reminder-settings');
    await expect(reminderSettings).toBeVisible();
    
    // Should show cadence explanation per spec FR-16.10
    await expect(reminderSettings).toContainText(/3.*10.*24.*tage/i);
    await expect(reminderSettings).toContainText(/automatisch/i);
  });

  test('should show reminder toggle with proper label', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('tab', { name: /profil/i }).click();
    
    // Should show toggle with proper input/label per spec FR-16.10
    const toggle = page.getByTestId('reminder-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('type', 'checkbox');
    
    // Should have associated label
    const label = page.locator('label[for]');
    await expect(label).toContainText(/benachrichtigungen/i);
  });

  test('should enable reminders when toggle is activated', async ({ page, context }) => {
    // Grant notification permission before test
    await context.grantPermissions(['notifications']);
    
    await completeOnboarding(page);
    await page.getByRole('tab', { name: /profil/i }).click();
    
    const toggle = page.getByTestId('reminder-toggle');
    
    // Should initially be unchecked
    await expect(toggle).not.toBeChecked();
    
    // Click to enable
    await toggle.click();
    
    // Should now be checked
    await expect(toggle).toBeChecked();
    
    // Should persist after reload per spec FR-16.10
    await page.reload();
    await page.getByRole('tab', { name: /profil/i }).click();
    await expect(page.getByTestId('reminder-toggle')).toBeChecked();
  });

  test('should show denied permission state correctly', async ({ page, context }) => {
    // Block notification permission
    await context.grantPermissions([]);
    
    await completeOnboarding(page);
    await page.getByRole('tab', { name: /profil/i }).click();
    
    const reminderSettings = page.getByTestId('reminder-settings');
    
    // Should show explanation instead of toggle per spec FR-16.11
    await expect(reminderSettings).toContainText(/browser.*einstellung/i);
    
    // Toggle should be disabled or hidden when permission denied
    const toggle = page.getByTestId('reminder-toggle');
    if (await toggle.isVisible()) {
      await expect(toggle).toBeDisabled();
    }
  });

  test('should show quiet hours information', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('tab', { name: /profil/i }).click();
    
    const reminderSettings = page.getByTestId('reminder-settings');
    
    // Should show quiet hours info per spec FR-16.10
    await expect(reminderSettings).toContainText(/22.*8.*uhr/i);
    await expect(reminderSettings).toContainText(/stille/i);
  });

  test('should display streak statistics', async ({ page }) => {
    // Set up some streak data
    await page.goto('/');
    await page.evaluate(() => {
      const streakData = {
        streak: {
          current: 5,
          longest: 12,
          lastAnswerDate: '2026-04-25',
        },
      };
      localStorage.setItem('remember-me-state', JSON.stringify(streakData));
    });
    
    await completeOnboarding(page);
    await page.getByRole('tab', { name: /profil/i }).click();
    
    const reminderSettings = page.getByTestId('reminder-settings');
    
    // Should show current and longest streak per spec FR-16.10
    await expect(reminderSettings).toContainText(/5/); // Current streak
    await expect(reminderSettings).toContainText(/12/); // Longest streak
    await expect(reminderSettings).toContainText(/serie|streak/i);
  });

  test('should not show cadence selector', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('tab', { name: /profil/i }).click();
    
    const reminderSettings = page.getByTestId('reminder-settings');
    
    // Should NOT have cadence selector per spec FR-16.10
    await expect(reminderSettings.locator('select')).not.toBeVisible();
    await expect(reminderSettings.locator('input[type="radio"]')).not.toBeVisible();
    await expect(reminderSettings.locator('input[type="range"]')).not.toBeVisible();
  });

  test('should request permission when enabling toggle', async ({ page, context }) => {
    await completeOnboarding(page);
    await page.getByRole('tab', { name: /profil/i }).click();
    
    const toggle = page.getByTestId('reminder-toggle');
    
    // Mock permission request dialog
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    
    await toggle.click();
    
    // Should handle permission flow per spec FR-16.11
    await expect(toggle).toBeChecked();
  });

  test('should disable reminder when permission is denied', async ({ page, context }) => {
    await completeOnboarding(page);
    await page.getByRole('tab', { name: /profil/i }).click();
    
    const toggle = page.getByTestId('reminder-toggle');
    
    // Mock permission denial
    page.on('dialog', async dialog => {
      await dialog.dismiss();
    });
    
    await toggle.click();
    
    // Should remain unchecked when permission denied per spec FR-16.11
    await expect(toggle).not.toBeChecked();
  });

  test('should show iOS fallback message on unsupported browsers', async ({ page }) => {
    // Mock iOS/unsupported environment
    await page.addInitScript(() => {
      // Remove showTrigger to simulate iOS
      delete (window.Notification as any).prototype.showTrigger;
    });
    
    await completeOnboarding(page);
    await page.getByRole('tab', { name: /profil/i }).click();
    
    const reminderSettings = page.getByTestId('reminder-settings');
    
    // Should show iOS explanation per spec NFR-iOS-Behavior
    await expect(reminderSettings).toContainText(/ios/i);
    await expect(reminderSettings).toContainText(/app/i);
    
    // Toggle should be disabled
    const toggle = page.getByTestId('reminder-toggle');
    await expect(toggle).toBeDisabled();
  });

  test('should persist reminder state across sessions', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    
    await completeOnboarding(page);
    await page.getByRole('tab', { name: /profil/i }).click();
    
    // Enable reminder
    const toggle = page.getByTestId('reminder-toggle');
    await toggle.click();
    await expect(toggle).toBeChecked();
    
    // Check localStorage contains new key per spec FR-16.13
    const reminderState = await page.evaluate(() => {
      return localStorage.getItem('rm-reminder-state');
    });
    
    expect(reminderState).toBeTruthy();
    const parsed = JSON.parse(reminderState);
    expect(parsed.permission).toBe('enabled');
    
    // Reload and verify persistence
    await page.reload();
    await page.getByRole('tab', { name: /profil/i }).click();
    await expect(page.getByTestId('reminder-toggle')).toBeChecked();
  });
});

test.describe('Welcome Back Banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should show welcome back banner after 4-day gap', async ({ page }) => {
    // Set up state with 4-day gap per spec FR-16.8
    await page.goto('/');
    await page.evaluate(() => {
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      
      const stateData = {
        lastVisit: fourDaysAgo.toISOString(),
        answeredQuestions: ['q1', 'q2'],
        categories: [
          { id: 'cat1', questions: ['q1', 'q2', 'q3'], title: 'Familie' }
        ],
      };
      localStorage.setItem('remember-me-state', JSON.stringify(stateData));
    });

    await completeOnboarding(page);
    
    // Should show welcome back banner per spec FR-16.8
    const banner = page.getByTestId('welcome-back-banner');
    await expect(banner).toBeVisible();
    
    // Should have correct CSS classes per spec FR-16.8
    await expect(banner).toHaveClass(/update-banner.*welcome-back-banner/);
    
    // Should have accessibility attributes per spec section 5
    await expect(banner).toHaveAttribute('role', 'alert');
    await expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  test('should not show welcome back banner for less than 3 days gap', async ({ page }) => {
    // Set up state with only 2-day gap
    await page.goto('/');
    await page.evaluate(() => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      const stateData = {
        lastVisit: twoDaysAgo.toISOString(),
        answeredQuestions: ['q1'],
      };
      localStorage.setItem('remember-me-state', JSON.stringify(stateData));
    });

    await completeOnboarding(page);
    
    // Should NOT show banner for <3 days per spec FR-16.8
    await expect(page.getByTestId('welcome-back-banner')).not.toBeVisible();
  });

  test('should navigate to next question on continue button click', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      
      const stateData = {
        lastVisit: fiveDaysAgo.toISOString(),
        answeredQuestions: ['q1'],
        categories: [
          { id: 'cat1', questions: ['q1', 'q2'], title: 'Familie' }
        ],
      };
      localStorage.setItem('remember-me-state', JSON.stringify(stateData));
    });

    await completeOnboarding(page);
    
    const banner = page.getByTestId('welcome-back-banner');
    await expect(banner).toBeVisible();
    
    // Should show "Weitermachen" CTA per spec FR-16.8
    const continueButton = banner.getByRole('button', { name: /weitermachen/i });
    await expect(continueButton).toBeVisible();
    
    await continueButton.click();
    
    // Should navigate to next open question per spec FR-16.8
    await expect(page).toHaveURL(/\/question\/q2/);
  });

  test('should show welcome back banner regardless of reminder toggle', async ({ page }) => {
    // Set up state with reminder disabled but 4-day gap
    await page.goto('/');
    await page.evaluate(() => {
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      
      const stateData = {
        lastVisit: fourDaysAgo.toISOString(),
        answeredQuestions: ['q1'],
      };
      localStorage.setItem('remember-me-state', JSON.stringify(stateData));
      
      // Reminder disabled
      const reminderState = { permission: 'none', backoffStage: 0 };
      localStorage.setItem('rm-reminder-state', JSON.stringify(reminderState));
    });

    await completeOnboarding(page);
    
    // Should show banner even without reminder permission per spec FR-16.8
    const banner = page.getByTestId('welcome-back-banner');
    await expect(banner).toBeVisible();
  });
});

test.describe('Streak Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should display current and longest streak in profile', async ({ page }) => {
    // Set up streak data
    await page.goto('/');
    await page.evaluate(() => {
      const streakData = {
        streak: {
          current: 7,
          longest: 15,
          lastAnswerDate: '2026-04-26',
        },
      };
      localStorage.setItem('remember-me-state', JSON.stringify(streakData));
    });
    
    await completeOnboarding(page);
    await page.getByRole('tab', { name: /profil/i }).click();
    
    const reminderSettings = page.getByTestId('reminder-settings');
    
    // Should show current streak per spec FR-16.10
    await expect(reminderSettings).toContainText(/7/);
    
    // Should show longest streak per spec FR-16.10  
    await expect(reminderSettings).toContainText(/15/);
    
    // Should have streak labels
    await expect(reminderSettings).toContainText(/aktuelle|current/i);
    await expect(reminderSettings).toContainText(/beste|longest/i);
  });

  test('should update streak when answering questions', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const streakData = {
        streak: {
          current: 3,
          longest: 8,
          lastAnswerDate: yesterday.toISOString().split('T')[0],
        },
        categories: [
          { 
            id: 'cat1', 
            questions: ['q1', 'q2'], 
            title: 'Familie',
            completedQuestions: ['q1']
          }
        ],
      };
      localStorage.setItem('remember-me-state', JSON.stringify(streakData));
    });
    
    await completeOnboarding(page);
    
    // Answer a question to increment streak
    await page.goto('/question/q2');
    const answerButton = page.getByRole('button', { name: /antwort|weiter/i }).first();
    await answerButton.click();
    
    // Check updated streak in profile
    await page.getByRole('tab', { name: /profil/i }).click();
    const reminderSettings = page.getByTestId('reminder-settings');
    
    // Streak should have incremented from 3 to 4
    await expect(reminderSettings).toContainText(/4/);
  });
});

test.describe('Milestone Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should show milestone notification at 10 answered questions', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    
    // Set up state with 9 answered questions
    await page.goto('/');
    await page.evaluate(() => {
      const stateData = {
        answeredQuestions: new Array(9).fill('question'),
        categories: [
          { 
            id: 'cat1', 
            questions: ['q10'], 
            title: 'Familie',
            completedQuestions: []
          }
        ],
      };
      localStorage.setItem('remember-me-state', JSON.stringify(stateData));
    });
    
    await completeOnboarding(page);
    
    // Listen for notification
    let notificationShown = false;
    await page.exposeFunction('captureNotification', () => {
      notificationShown = true;
    });
    
    await page.addInitScript(() => {
      const originalShowNotification = navigator.serviceWorker.ready.then(reg => reg.showNotification);
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification = function(title, options) {
          if (title.includes('10')) {
            (window as any).captureNotification();
          }
          return originalShowNotification.call(this, title, options);
        };
      });
    });
    
    // Answer the 10th question
    await page.goto('/question/q10');
    const answerButton = page.getByRole('button', { name: /antwort|weiter/i }).first();
    await answerButton.click();
    
    // Should trigger milestone notification per spec FR-16.7
    await expect(async () => {
      expect(notificationShown).toBe(true);
    }).toPass({ timeout: 5000 });
  });
});

test.describe('Notification Variant Rotation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should show different notification variants on consecutive triggers', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    
    // Set up reminder enabled
    await page.goto('/');
    await page.evaluate(() => {
      const reminderState = {
        permission: 'enabled',
        backoffStage: 1,
        lastShownAt: Date.now() - (4 * 24 * 60 * 60 * 1000), // 4 days ago
        lastVariantIdx: 0,
      };
      localStorage.setItem('rm-reminder-state', JSON.stringify(reminderState));
    });
    
    await completeOnboarding(page);
    
    // Capture notification content
    const notificationContents: string[] = [];
    await page.exposeFunction('captureNotificationContent', (body: string) => {
      notificationContents.push(body);
    });
    
    await page.addInitScript(() => {
      const originalShowNotification = navigator.serviceWorker.ready.then(reg => reg.showNotification);
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification = function(title, options) {
          (window as any).captureNotificationContent(options?.body || '');
          return originalShowNotification.call(this, title, options);
        };
      });
    });
    
    // Trigger first notification
    await page.evaluate(() => {
      // Simulate app visibility change to trigger reminder check per spec FR-16.12
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    await page.waitForTimeout(1000);
    
    // Trigger second notification with different variant
    await page.evaluate(() => {
      const reminderState = {
        permission: 'enabled',
        backoffStage: 2,
        lastShownAt: Date.now() - (11 * 24 * 60 * 60 * 1000), // 11 days ago
        lastVariantIdx: 1,
      };
      localStorage.setItem('rm-reminder-state', JSON.stringify(reminderState));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    await page.waitForTimeout(1000);
    
    // Should show different variants per spec FR-16.3
    expect(notificationContents.length).toBeGreaterThanOrEqual(1);
    if (notificationContents.length >= 2) {
      expect(notificationContents[0]).not.toBe(notificationContents[1]);
    }
  });
});

test.describe('Legacy Key Cleanup', () => {
  test('should remove legacy rm-reminder-pref key on app start', async ({ page }) => {
    // Set up legacy key
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('rm-reminder-pref', 'enabled');
    });
    
    // Verify legacy key exists
    let legacyKey = await page.evaluate(() => {
      return localStorage.getItem('rm-reminder-pref');
    });
    expect(legacyKey).toBe('enabled');
    
    // Start app (which should trigger hook initialization)
    await completeOnboarding(page);
    
    // Legacy key should be removed per spec FR-16.13
    legacyKey = await page.evaluate(() => {
      return localStorage.getItem('rm-reminder-pref');
    });
    expect(legacyKey).toBeNull();
  });
});