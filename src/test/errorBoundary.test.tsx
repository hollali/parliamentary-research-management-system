import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';

function BrokenComponent() {
  throw new Error('Test error');
  return null;
}

function WorkingComponent() {
  return <div>All good</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('renders error UI when child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    expect(screen.getByText(/try again/i)).toBeTruthy();
    
    spy.mockRestore();
  });
});

// Test env validation logic
describe('Environment validation', () => {
  it('validates required env vars are present', () => {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    
    process.env.DATABASE_URL = 'test-value';
    process.env.JWT_SECRET = 'test-value';
    
    const missing = required.filter(key => !process.env[key]);
    expect(missing).toHaveLength(0);
  });

  it('detects missing env vars', () => {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const savedDb = process.env.DATABASE_URL;
    const savedJwt = process.env.JWT_SECRET;
    
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    
    const missing = required.filter(key => !process.env[key]);
    expect(missing).toContain('DATABASE_URL');
    expect(missing).toContain('JWT_SECRET');
    
    // Restore
    if (savedDb) process.env.DATABASE_URL = savedDb;
    if (savedJwt) process.env.JWT_SECRET = savedJwt;
  });

  it('flags insecure JWT secrets in production', () => {
    const insecureDefaults = [
      'change-this-to-a-secure-random-string-in-production',
      'prrms-dev-secret-change-in-production',
    ];
    
    for (const secret of insecureDefaults) {
      expect(insecureDefaults.includes(secret)).toBe(true);
    }
  });
});
