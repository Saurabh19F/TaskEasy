/**
 * Jest setup: extends expect with @testing-library/jest-dom matchers
 */
import '@testing-library/jest-dom';

// Suppress noisy console.error for known Next.js/React act() warnings
const originalError = console.error.bind(console.error);
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('act(') || args[0].includes('Warning:'))
    ) {
      return;
    }
    originalError(...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
