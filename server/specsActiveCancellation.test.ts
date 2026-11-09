import { describe, expect, it } from "vitest";
import { buildCancelledSkuKeySet, isCancelledSku, type CancelledSkuIdentity } from "../shared/cancelledSkuIdentity";
import { buildSpecColourKeyLookup, getSpecSkuIdentity, type SpecColourSku } from "../shared/specColourKey";
import { excludeCancelledSpecStyles } from "../shared/specsStyleVisibility";
import { buildNewSpecColourColumns } from "../shared/specSeasonalColumns";

function activeSpecEntries(skus: SpecColourSku[], cancelled: CancelledSkuIdentity[], cancelledStyles = new Set<string>()) {
  // Same ordered stages as useCustomSkus -> SpecsTab: filter physical identities
  // once, derive live column keys, then apply only whole-style cancellations.
  const cancelledKeys = buildCancelledSkuKeySet(cancelled);
  const active = skus.filter(sku => !isCancelledSku(cancelledKeys, sku));
  const keys = buildSpecColourKeyLookup(active);
  const entries = Array.from(new Set(active.map(sku => sku.style))).map(style => ({
    style,
    colours: active.filter(sku => sku.style === style).map(sku => keys.get(getSpecSkuIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2))),
    labels: active.filter(sku => sku.style === style).map(sku => [sku.colour, sku.leather].filter(Boolean).join(' ') + (sku.colour2 ? '/' + [sku.colour2, sku.leather2].filter(Boolean).join(' ') : '')),
  }));
  return { active, entries: excludeCancelledSpecStyles(entries, cancelledStyles) };
}

describe('Specs uses the shared active cancellation range', () => {
  const nappa = { style: 'ESSA', colour: 'BLACK', leather: 'NAPPA' };
  const supra = { style: 'ESSA', colour: 'BLACK', leather: 'SUPRA' };
  it('keeps ESSA Black Nappa when cancelled Black Supra is no longer in the key lookup', () => {
    const result = activeSpecEntries([nappa, supra, { style: 'ESSA', colour: 'DOVE', leather: 'NAPPA' }], [supra]);
    expect(result.entries[0]).toEqual({ style: 'ESSA', colours: ['BLACK', 'DOVE'], labels: ['BLACK NAPPA', 'DOVE NAPPA'] });
    expect(buildNewSpecColourColumns(result.active.map(sku => ({ ...sku, is_new: true }))).ESSA).toContain('BLACK');
    expect(result.active).not.toContainEqual(supra);
  });
  it('keeps the valid Upper 2 sibling after cancelling the other construction', () => {
    const royal = { style: 'EMILY', colour: 'ECRU', leather: 'SNAKE', colour2: 'ROYAL', leather2: 'SUEDE' };
    const lipstick = { ...royal, colour2: 'LIPSTICK' };
    const result = activeSpecEntries([royal, lipstick], [royal]);
    expect(result.entries[0].labels).toEqual(['ECRU SNAKE/LIPSTICK SUEDE']);
    expect(result.active).toEqual([lipstick]);
  });
  it('does not revive a truly cancelled colour or a cancelled whole style', () => {
    expect(activeSpecEntries([nappa, supra], [nappa, supra]).entries).toEqual([]);
    expect(activeSpecEntries([nappa], [], new Set(['ESSA'])).entries).toEqual([]);
  });
  it('preserves all active entry fields and intentional hidden-column keys without rewriting spec labels', () => {
    const entry = { style: 'ESSA', colours: ['BLACK', 'PURPLE'], colourLabels: ['BLACK NAPPA', 'PURPLE SUEDE'], toeCapsPerColour: {} };
    const [visible] = excludeCancelledSpecStyles([entry], new Set());
    expect(visible).toBe(entry);
    const hidden = new Set(['PURPLE']);
    expect(visible.colours.filter(key => !hidden.has(key))).toEqual(['BLACK']);
    expect(visible.colourLabels[0]).toBe('BLACK NAPPA');
  });
});
