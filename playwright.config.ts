import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Family Album web application
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './tests',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only - reduce retries to speed up failing tests
  retries: process.env.CI ? 1 : 0,
  
  // Use 2 workers on CI for parallel execution (faster than 1, still stable)
  workers: process.env.CI ? 2 : undefined,
  
  // Reporter to use
  reporter: [
    ['html'],
    ['list']
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL for tests
    baseURL: 'http://localhost:3000',
    
    // Collect trace when retrying failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure - disabled in Copilot environment due to ffmpeg requirements
    video: process.env.COPILOT_AGENT_ACTION ? 'off' : 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use system-installed Chromium in GitHub Copilot environment
        // This avoids browser download issues when Playwright browsers can't be installed
        launchOptions: process.env.COPILOT_AGENT_ACTION ? {
          executablePath: '/usr/bin/chromium-browser',
        } : undefined,
      },
    },

    // Only run chromium in Copilot environment to speed up tests
    // Firefox and Webkit require their own browser installations
    ...(process.env.COPILOT_AGENT_ACTION ? [] : [
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },

      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
    ]),

    // Test against mobile viewports
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        // Use system-installed Chromium for mobile tests in Copilot environment
        launchOptions: process.env.COPILOT_AGENT_ACTION ? {
          executablePath: '/usr/bin/chromium-browser',
        } : undefined,
      },
    },
    
    // Only run Mobile Safari outside of Copilot environment
    ...(process.env.COPILOT_AGENT_ACTION ? [] : [
      {
        name: 'Mobile Safari',
        use: { ...devices['iPhone 12'] },
      },
    ]),
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 120 * 1000,
    env: {
      // Enable dev mode for tests to bypass authentication
      DEV_MODE: 'true',
      DEV_USER_EMAIL: 'test@example.com',
      DEV_USER_ROLE: 'Admin',
      // Use test database or mock data
      // Add your test database credentials here if needed
    },
  },
});
