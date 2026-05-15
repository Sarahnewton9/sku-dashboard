
## SS26 Export Corrections (May 2026)

### Add new SKUs (green)
- [x] DIXIE — add Black Capri (New)
- [x] DIXON — add Black Nappa Patent/Fur (New)
- [x] HARLEY — add Chocolate Venice (New)
- [x] HILTON — add Chocolate Venice (New)
- [x] KIMBA — add Black Pony (New)
- [x] ROBYN — add Black Suede (New)
- [x] RORY — add Vanilla Nappa (New)
- [x] ROXIE — add Milk Capretto (New, toe cap: Black Patent)
- [x] SALLY — add Black Speckle (New)
- [x] SARAH — add Espresso Suede (New, toe cap: Choc Vintage)
- [x] SIA — add Choc Satin (New)
- [x] SPOILT — add Ivory Satin (New)
- [x] SWAY — add Silver Nappa Metallic (New)
- [x] TILDA — add Chocolate Venice (New)
- [x] TINA — add Petal Nappa (New)
- [x] TREVI — add Choc Vintage (New)
- [x] TREVI — add Chocolate Venice (New)
- [x] VILLA — add Sky Suede (New)
- [x] VINE — add Willow Nubuck (New)
- [x] VOLLI — add Tan Vintage (New)

### Updates (yellow)
- [x] ENVY Black — update leather to Capri
- [x] PAXOS Black Brocade — update category and last (use values from export)
- [x] PAXOS Ivory Brocade — update category and last (use values from export)
- [x] SAMMY Black — update leather to Venice
- [x] SIA Black — update leather to Capri

### Cancel (keep in system, mark cancelled)
- [x] FAVE Choc Vintage — cancel
- [x] MAMZELLE Black Nappa — cancel
- [x] MAMZELLE Peru Nappa — cancel
- [x] MAMZELLE Dove Nappa — cancel
- [x] ROBYN Black Speckle — cancel
- [x] VIKA Choc Venice — cancel

### Delete (remove entirely — duplicates)
- [x] MARAMEO Choc Snake — delete (same as Espresso)
- [x] MARAMEO Black Snake — delete (same as Onyx)

### Toe cap data (42 SKUs across 12 styles)
- [x] CAPPA Dove — toe cap: Black Nappa
- [x] CAPPA Peru — toe cap: Black Nappa
- [x] CAPPA Sky — toe cap: Vino Nappa
- [x] CAPPA Petal — toe cap: Vino Nappa
- [x] DONTE Vanilla — toe cap: Black Venice
- [x] DONTE Peru — toe cap: Black Venice
- [x] DONTE Black (Nappa) — toe cap: Black Patent
- [x] DONTE Sky — toe cap: Vino Nappa
- [x] DONTE Vino — toe cap: Petal Nappa
- [x] DONTE Black Speckle — toe cap: Black Speckle
- [x] EMILY Mint — toe cap: Black Patent
- [x] EMILY Petal — toe cap: Black Patent
- [x] EMILY Black — toe cap: Black Patent
- [x] EMILY Tan — toe cap: Taupe Suede
- [x] EMILY Sky — toe cap: Denim Suede
- [x] LEGACY Black — toe cap: Black Patent
- [x] LEGACY Peru — toe cap: Black Patent
- [x] LEGACY Dove — toe cap: Black Patent
- [x] LEGACY Petal — toe cap: Petal Nappa Patent
- [x] LEGACY Turquoise — toe cap: Turquoise Nappa Patent
- [x] PIXIE Black (Speckle) — toe cap: Black Speckle
- [x] PIXIE Choc — toe cap: Black Nappa
- [x] PIXIE Vanilla — toe cap: Black Nappa
- [x] PIXIE Vino — toe cap: Black Nappa
- [x] ROBYN Milk — toe cap: Black Patent
- [x] ROBYN Silver — toe cap: Black Gros Grain
- [x] ROBYN Gold — toe cap: Black Gros Grain
- [x] ROBYN Vino — toe cap: Petal Nappa
- [x] ROBYN Black (Nappa) — toe cap: Black Patent
- [x] ROBYN Vanilla — toe cap: Black Nappa
- [x] ROBYN Black Speckle — toe cap: Black Patent (new SKU)
- [x] ROXIE Turquoise — toe cap: Black Nappa
- [x] ROXIE Peru — toe cap: Black Nappa
- [x] ROXIE Milk — toe cap: Black Patent (new SKU)
- [x] SARAH Milk — toe cap: Black Venice
- [x] SARAH Petal — toe cap: Petal Nappa
- [x] SARAH Sky — toe cap: Denim Suede
- [x] SARAH Espresso — toe cap: Choc Vintage (new SKU)
- [x] SAVANT Taupe — toe cap: Tan Vintage
- [x] SAVANT Wheat — toe cap: Vanilla Vintage
- [x] SAVANT Espresso — toe cap: Choc Vintage
- [x] SAVANT Denim — toe cap: Sky Vintage

### Global rename
- [x] Rename all "Choc Venice" → "Chocolate Venice" throughout skuData.ts and DB

## Fit Report Export (May 2026)
- [x] Add exportFitReport function to generate Excel with style, last, category, fit rating, fit approved, most recent fit date, fit models, notes
- [x] Add "Fit Report" button to FittingTab toolbar
- [x] Only include styles that have been fitted (have sessions or fit rating set)

## Size Recommendation Field (May 2026)
- [x] Add size_recommendation column to style_fit_meta DB table (nullable varchar: "half_size_up", "full_size_up", "half_size_down", "full_size_down")
- [x] Add sizeRecommendation to getStyleFitMeta and upsertStyleFitMeta tRPC procedures
- [x] Show size recommendation selector in FittingTab only when fit rating is Runs Small or Runs Large
- [x] Include size recommendation in Fit Report Excel export column

## Fit Report Colourway Fix (May 2026)
- [x] Fix Fit Report export: propagate fit rating and size recommendation to all colourways of the same base style — confirmed data is already at base style level, one row per base style in export
- [x] Fix FittingTab UI: ensure fit rating lookup uses base style name — confirmed styleList is already base-style-level

## Fit Report Notes Bug (May 2026)
- [x] Investigate why fitting notes/comments are missing from the Fit Report Excel export
- [x] Fix export to include both style-level fittingNotes and per-session notes in the Notes column

## Cancelled Styles in Fit Report Export (May 2026)
- [x] Fix Fit Report export to exclude cancelled styles (MAMZELLE, CIRCA, etc.) — they currently appear despite being cancelled (FittingTab exports already use filtered styleList)

## Permanent Cancelled Style Exclusion from All Exports (May 2026)
- [x] Audit all export functions across all tabs to find every place styles/SKUs are included in exports
- [x] Ensure every export (Fit Report, Buy Export, Overview Export, Specs Export, etc.) filters out cancelled styles at the point of export using the cancelledStyleSet from the DB
- [x] Add a server-side helper that returns the cancelled style set so exports that run server-side are also protected

## Fit Report Per-Colourway Rows (May 2026)
- [x] Rewrite Fit Report export to output one row per colourway (all colours of each style), with the base style's fit rating and size recommendation applied to every colourway row
- [x] Exclude cancelled styles and cancelled SKUs from the per-colourway rows (via filtered styleList)
- [x] Notes and fit models on first colourway row only to keep it readable
