import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ season: 'W27' as 'SS26' | 'W27' }));
vi.mock('../client/src/contexts/SeasonContext', () => ({
  useSeason: () => ({ season: state.season }),
}));
vi.mock('../client/src/hooks/useCustomSkus', () => ({
  useCustomSkus: () => ({ mergedRawSkus: [
    { style: `${state.season}_WAITING`, colour: 'ECRU', leather: 'SNAKE', colour2: 'ROYAL', leather2: 'SUEDE', is_new: true },
    { style: `${state.season}_RECEIVED`, colour: 'BLACK', leather: 'NAPPA', is_new: true },
    { style: 'CARRY_OVER', colour: 'DOVE', leather: 'NAPPA', is_new: false },
  ] }),
}));
vi.mock('../client/src/hooks/useCancelledStyles', () => ({
  useCancelledStyles: () => ({ cancelledSet: new Set() }),
}));
vi.mock('../client/src/lib/trpc', () => {
  const empty = { useQuery: () => ({ data: [] }) };
  return { trpc: {
    cancelledSku: { list: empty }, lastApproval: { getAll: empty, getDeleted: empty }, customLast: { getAll: empty },
    sku: { getAll: { useQuery: () => ({ data: [
      { style: `${state.season}_RECEIVED`, colour: 'BLACK', leather: 'NAPPA', sampleStatus: 'received' },
    ] }) }, update: { useMutation: () => ({ mutateAsync: vi.fn() }) } },
    useUtils: () => ({}),
  } };
});
vi.mock('../client/src/components/ui/popover', () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => children;
  return { Popover: Wrapper, PopoverContent: Wrapper, PopoverTrigger: Wrapper };
});
vi.mock('recharts', () => {
  const Empty = () => null;
  return { BarChart: Empty, Bar: Empty, XAxis: Empty, YAxis: Empty, Tooltip: Empty, ResponsiveContainer: Empty };
});

import SummaryCards from '../client/src/components/dashboard/SummaryCards';

beforeEach(() => { state.season = 'W27'; vi.stubGlobal('React', React); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('seasonal Overview sample control parity', () => {
  it.each(['SS26', 'W27'] as const)('renders searchable Received/Waiting lists with Rcvd controls in %s', (season) => {
    state.season = season;
    const html = renderToStaticMarkup(React.createElement(SummaryCards));
    expect(html).toContain(`${season} Sample Tracking`);
    expect(html).toContain(`${season} — Waiting on Samples`);
    expect(html).toContain(`${season} — Received Samples`);
    expect(html).toContain('Search waiting on samples');
    expect(html).toContain(`Mark received: ${season}_WAITING`);
    expect(html).toContain(`Mark waiting: ${season}_RECEIVED`);
    expect(html).toContain('>Rcvd</button>');
    expect(html).toContain('ECRU SNAKE/ROYAL SUEDE');
    expect(html).not.toContain('CARRY_OVER');
    expect(html).not.toContain(`${season === 'W27' ? 'SS26' : 'W27'}_WAITING`);
  });
});
