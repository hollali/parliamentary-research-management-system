import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock the AppContext
const mockLogin = vi.fn().mockResolvedValue(true);
vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    currentUser: { id: '', name: '', role: 'MP', email: '', initials: '', title: '' },
    requests: [],
    notifications: [],
    history: [],
    isOnline: true,
    login: mockLogin,
  }),
  AppProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock the api
vi.mock('../lib/api', () => ({
  forgotPassword: vi.fn().mockResolvedValue({}),
  resetPasswordWithToken: vi.fn().mockResolvedValue({}),
}));

import { LoginView } from '../components/LoginView';

describe('LoginView', () => {
  it('renders the login form', () => {
    const onLoginSuccess = vi.fn();
    render(<LoginView onLoginSuccess={onLoginSuccess} />);
    
    expect(screen.getByText('Portal Login')).toBeTruthy();
    expect(screen.getByLabelText(/email address/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    expect(screen.getByText('Authenticate & Access')).toBeTruthy();
  });

  it('renders demo login buttons', () => {
    const onLoginSuccess = vi.fn();
    render(<LoginView onLoginSuccess={onLoginSuccess} />);
    
    expect(screen.getByText('Admin Officer')).toBeTruthy();
    expect(screen.getByText('Research Officer')).toBeTruthy();
    expect(screen.getByText('Honorable Member')).toBeTruthy();
  });

  it('renders forgot password link', () => {
    const onLoginSuccess = vi.fn();
    render(<LoginView onLoginSuccess={onLoginSuccess} />);
    
    expect(screen.getByText('Forgot password?')).toBeTruthy();
  });

  it('email input is required and has correct type', () => {
    const onLoginSuccess = vi.fn();
    render(<LoginView onLoginSuccess={onLoginSuccess} />);
    
    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    expect(emailInput.type).toBe('email');
    expect(emailInput.required).toBe(true);
  });

  it('toggles password visibility', () => {
    const onLoginSuccess = vi.fn();
    render(<LoginView onLoginSuccess={onLoginSuccess} />);
    
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    
    // Find the eye toggle button (sibling of password input)
    const toggleBtn = passwordInput.parentElement?.querySelector('button');
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
      expect(passwordInput.type).toBe('text');
    }
  });
});
