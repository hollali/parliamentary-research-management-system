import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Example', () => {
  it('renders correctly', () => {
    render(<div>Hello PRRMS</div>);
    expect(screen.getByText('Hello PRRMS')).toBeInTheDocument();
  });
});
