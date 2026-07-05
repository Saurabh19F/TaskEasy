/**
 * Unit tests for StatusBadge and PriorityBadge components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';

// ─── StatusBadge ──────────────────────────────────────────────────────────────

describe('<StatusBadge />', () => {
  const statuses = [
    'PENDING',
    'IN_PROGRESS',
    'SEND_FOR_APPROVAL',
    'REWORK',
    'COMPLETED',
    'LATE',
  ];

  it.each(statuses)('renders label for status %s', (status) => {
    render(<StatusBadge status={status} />);
    // Label should be human-readable (not raw enum), e.g. SEND_FOR_APPROVAL → "Send For Approval"
    const el = screen.getByText((t) => t.toLowerCase().includes(status.split('_')[0].toLowerCase()));
    expect(el).toBeInTheDocument();
  });

  it('renders unknown status without crashing', () => {
    render(<StatusBadge status="UNKNOWN_STATUS" />);
    // Should still render something
    const badge = document.querySelector('[class*="rounded"]');
    expect(badge).toBeTruthy();
  });

  it('renders a fallback label when status is missing', () => {
    render(<StatusBadge status={undefined} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('applies a colour class derived from STATUS_COLORS map', () => {
    const { container } = render(<StatusBadge status="COMPLETED" />);
    // COMPLETED maps to green-100 classes
    expect(container.innerHTML).toMatch(/green/);
  });
});

// ─── PriorityBadge ────────────────────────────────────────────────────────────

describe('<PriorityBadge />', () => {
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'];

  it.each(priorities)('renders label for priority %s', (priority) => {
    render(<PriorityBadge priority={priority} />);
    // First letter should appear (case-insensitive)
    expect(screen.getByText(new RegExp(priority, 'i'))).toBeInTheDocument();
  });

  it('applies bold class for CRITICAL', () => {
    const { container } = render(<PriorityBadge priority="CRITICAL" />);
    expect(container.innerHTML).toMatch(/font-bold/);
  });

  it('renders a fallback label when priority is missing', () => {
    render(<PriorityBadge priority={null} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
