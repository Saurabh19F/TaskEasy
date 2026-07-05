/**
 * Unit tests for DataTable — sort, search, pagination
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DataTable, Column } from '@/components/ui/DataTable';

interface Row {
  id: string;
  name: string;
  score: number;
}

const COLUMNS: Column<Row>[] = [
  { key: 'id',    header: 'ID',    sortable: true },
  { key: 'name',  header: 'Name',  sortable: true },
  { key: 'score', header: 'Score', sortable: true },
];

// 30 rows so pagination kicks in (default pageSize = 25)
const ROWS: Row[] = Array.from({ length: 30 }, (_, i) => ({
  id: `ROW-${String(i + 1).padStart(3, '0')}`,
  name: i % 2 === 0 ? `Alice-${i}` : `Bob-${i}`,
  score: i * 3,
}));

function renderTable(overrides?: Partial<React.ComponentProps<typeof DataTable<Row>>>) {
  return render(
    <DataTable
      columns={COLUMNS}
      data={ROWS}
      loading={false}
      rowKey={(r) => r.id}
      {...overrides}
    />,
  );
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('DataTable rendering', () => {
  it('renders column headers', () => {
    renderTable();
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('renders empty message when data is empty', () => {
    renderTable({ data: [], emptyMessage: 'Nothing here' });
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows skeleton rows when loading', () => {
    const { container } = renderTable({ loading: true });
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────

describe('DataTable pagination', () => {
  it('shows only pageSize rows on first page (default 25)', () => {
    renderTable();
    // 30 rows but only 25 rendered on page 1
    const cells = screen.getAllByText(/ROW-0/);
    expect(cells.length).toBeLessThanOrEqual(25);
  });

  it('shows page info text', () => {
    renderTable();
    // "Showing 1 – 25 of 30"
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
  });

  it('navigates to next page', () => {
    renderTable();
    const nextBtn = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextBtn);
    // Page 2 should show row 26+
    expect(screen.getByText('ROW-026')).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    renderTable();
    const prevBtn = screen.getByRole('button', { name: /prev/i });
    expect(prevBtn).toBeDisabled();
  });
});

// ─── Search ───────────────────────────────────────────────────────────────────

describe('DataTable search', () => {
  it('filters rows by search term', () => {
    renderTable();
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'Alice' } });
    // All visible rows should contain Alice
    const nameCells = screen.queryAllByText(/Alice/);
    expect(nameCells.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Bob/)).toBeNull();
  });

  it('shows empty state when search finds nothing', () => {
    renderTable();
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'zzznomatch' } });
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it('resets to page 1 after search', () => {
    renderTable();
    // Go to page 2
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Search — should reset to page 1
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'Alice' } });
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });
});

// ─── Sorting ──────────────────────────────────────────────────────────────────

describe('DataTable sorting', () => {
  it('sorts ascending on first click of sortable column', () => {
    renderTable();
    fireEvent.click(screen.getByText('Score'));
    // First row should have score 0
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('0')).toBeInTheDocument();
  });

  it('sorts descending on second click', () => {
    renderTable();
    fireEvent.click(screen.getByText('Score'));
    fireEvent.click(screen.getByText('Score'));
    // First row should have the highest score (29 * 3 = 87)
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('87')).toBeInTheDocument();
  });
});
