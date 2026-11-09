import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrpcContext } from './_core/context';
import { buildMarkdownSkuSet } from '../shared/markdownSku';
import { isActiveBuySheetSessionItem } from '../shared/buySheetSkuExclusions';

const dbMock = vi.hoisted(() => ({ getMarkdownSkus: vi.fn() }));
vi.mock('./db', () => ({ getMarkdownSkus: dbMock.getMarkdownSkus }));
import { appRouter } from './routers';
const ctx: TrpcContext = {
  user: { id: 1, openId: 'markdown-test', name: 'Range Team', email: 'range@example.com', loginMethod: null, role: 'admin', createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { headers: {} } as any,
  res: { clearCookie: vi.fn() } as any,
};
const records = [
  { styleCode: 'APACHE', colour: 'CHOC VINTAGE', status: 'deleted' },
  { styleCode: 'APACHE', colour: 'BLACK COMO', status: 'pending' },
  { styleCode: 'APACHE', colour: 'TAN VINTAGE', status: 'restored' },
];

describe('Buy Sheet markdown list input and exclusion contract', () => {
  beforeEach(() => { vi.clearAllMocks(); dbMock.getMarkdownSkus.mockResolvedValue(records); });
  it('loads all approved and pending removals using the required empty object', async () => {
    const result = await appRouter.createCaller(ctx).markdown.list({});
    expect(result).toEqual(records);
    expect(dbMock.getMarkdownSkus).toHaveBeenCalledWith(undefined);
  });
  it('rejects a missing input instead of silently treating the list as empty', async () => {
    await expect(appRouter.createCaller(ctx).markdown.list(undefined as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(dbMock.getMarkdownSkus).not.toHaveBeenCalled();
  });
  it('excludes only listed colourways from the shared preview/download/email Buy Sheet path', async () => {
    const rows = await appRouter.createCaller(ctx).markdown.list({});
    const markdownSkuSet = buildMarkdownSkuSet(rows);
    const input = { markdownSkuSet, cancelledStyleNames: new Set<string>(), cancelledSkuKeys: new Set<string>() };
    const items = [
      { style: 'APACHE', colour: 'CHOC', leather: 'VINTAGE', auQty: 80, usaQty: 20 },
      { style: 'APACHE', colour: 'BLACK', leather: 'COMO', auQty: 60 },
      { style: 'APACHE', colour: 'TAN', leather: 'VINTAGE', auQty: 40 },
      { style: 'APACHE', colour: 'BLACK', leather: 'NAPPA', auQty: 30 },
    ];
    const snapshot = JSON.stringify(items);
    expect(items.filter(item => isActiveBuySheetSessionItem(item, input)).map(item => [item.colour, item.leather])).toEqual([['TAN', 'VINTAGE'], ['BLACK', 'NAPPA']]);
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});
