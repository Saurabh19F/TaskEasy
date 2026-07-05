/**
 * Unit tests for login page form validation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock useRouter before importing the page
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  redirect: jest.fn(),
}));

jest.mock('@/hooks/useAuth', () => ({
  useLogin: () => ({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useLogout: () => ({ mutate: jest.fn() }),
  useMe: () => ({ data: null }),
}));

jest.mock('@/hooks/usePlatform', () => ({
  usePlatformLogin: () => ({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

jest.mock('@/store/auth.store', () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    setAccessToken: jest.fn(),
    setUser: jest.fn(),
    logout: jest.fn(),
    hasRole: () => false,
    isSuperAdmin: false,
  }),
}));

jest.mock('@/store/platform-auth.store', () => ({
  usePlatformAuthStore: () => ({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    setAccessToken: jest.fn(),
    setUser: jest.fn(),
    logout: jest.fn(),
  }),
}));

// Lazy import after mocks are set up
// eslint-disable-next-line @typescript-eslint/no-var-requires
const LoginPage = () => require('@/app/(auth)/login/page').default();

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Login page', () => {
  it('renders email and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders the Log In button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('shows validation error when email is empty on submit', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => {
      expect(screen.getByText(/email/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email format', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when password is empty', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText(/email/i), 'admin@test.com');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => {
      expect(screen.getByText(/password/i)).toBeInTheDocument();
    });
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');
    // Find toggle button (eye icon)
    const toggleBtn = screen.getByRole('button', { name: /show|hide|toggle/i });
    await user.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
