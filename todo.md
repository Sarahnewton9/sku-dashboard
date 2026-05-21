
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

## Full Export Fit Rating Bug (May 2026)
- [x] Fix Full Data Export: Fit Rating column now reads from style_meta.fitRating (style-level, set in Fittings tab) with fallback to per-SKU fitRating
- [x] Fit rating now applied to every SKU row for the matching style
- [x] ARLA now correctly shows Runs Large in the export

## Fit Rating Bulk Import + Size Recommendation Fix (May 2026)
- [x] Parse uploaded spreadsheet to identify style, fit rating, and size instruction columns
- [x] Bulk import fit ratings and size instructions from spreadsheet into style_meta via a migration script (234 styles imported)
- [x] Fix size recommendation dropdown: Runs Small → "Half size up / Full size up", Runs Large → "Half size down / Full size down" (already correct)
- [x] Verify imported data appears correctly in Fittings tab and By Style detail panel

## By Style Add SKU Bug (May 2026)
- [x] Fix: Adding a new colour/leather (e.g. Black Venice to MILAN) in By Style tab — was saving but no visible feedback; server-side duplicate check added
- [x] Fix: Adding a SKU caused duplicate entries — removed 6 duplicate MILAN BLACK VENICE rows; server now throws error on duplicate; toast moved to bottom-right with richColors for visibility

## Buy Session Changes Report (May 2026)
- [x] Add tRPC procedure to fetch all changes since a buy session started: cancelled styles, cancelled SKUs, new colours added (custom_skus)
- [x] Build Changes Report panel in Buy Sessions area: show CANCELLED STYLES, CANCELLED COLOURS, and NEW COLOURS ADDED sections
- [x] Add Export button to generate a clean Excel report (SS26_Changes_Report_SessionName_DD-MM-YYYY.xlsx)
- [x] Include style, colour, leather, category, and date of change in the export

## Changes Report Email (May 2026)
- [ ] Add sendChangesReport tRPC procedure that sends formatted HTML email to team (fatih, amanda, anthony, alison, sarah.newton @tonybianco.com)
- [ ] Add "Send to Team" button to Changes Report modal
- [ ] Email body: session name, date, three sections (Cancelled Styles, Cancelled Colours, New Colours Added) as HTML tables

## Buy Quantity Rollup & Always-Visible (May 2026)
- [x] Show buy quantities on every SKU row at all times (not gated by active buy session) — shows all-sessions AU/USA totals when no session selected
- [x] Add a running total rollup of total units bought (AU + USA) that updates as quantities are entered
- [x] Show total bought units per style (rollup across all colours/leathers of that style) — per-style Buy Qty column shows all-sessions total with AU/USA breakdown
- [x] Show grand total units bought across all styles in a summary bar or header — amber summary bar below Buy Session Bar shows Total Bought: AU X · USA Y · Z units total

## URL Routing for Shareable Tab Links (May 2026)
- [x] Replace useState tab switching with URL-based routing so each section has its own path (e.g. /styles, /fitting, /buy-sessions)
- [x] Sidebar nav items become links that update the URL; active tab is derived from the URL
- [x] Navigating to / redirects to /overview; unknown paths fall back to /overview
- [x] Browser back/forward buttons work correctly between tabs

## AI Dashboard Assistant Chatbot (May 2026)
- [x] Add skuIsNewOverride DB table + helper to override is_new flag per SKU
- [x] Add chat.command tRPC procedure using LLM tool-calling to interpret natural language commands
- [x] Add floating chat panel UI using AIChatBox component in the dashboard
- [x] Wire chat panel to chat.command mutation with conversation history
- [x] Support commands: mark SKU as new/existing, update sample status, cancel/restore SKU, cancel style

## NESTA VANILLA VINTAGE Override Fix (May 2026)
- [x] Debug why per-SKU override for NESTA VANILLA VINTAGE is not applying in StylesTab despite assistant saying Done
- [x] Ensure the override key lookup matches exactly what is stored in DB — fixed __ALL__ vs __all__ case mismatch and colour+leather split

## Specs Tab Improvements (May 2026)
- [x] Rename all spec sections to a single "Components" section — no separate Construction/Upper sections
- [x] Toe cap field moves into Components (not Construction)
- [x] Free-type rows: each component row is a free-type text box, not a dropdown with fixed options
- [x] Insert row like Excel: + button between rows to insert at any position
- [x] Delete dropdown options with a small X when required
- [x] When copying spec from one colour to another, do NOT copy Upper 1 field
- [x] Add New Colour/SKU button inside each style in the Specs tab
- [x] Remove buckle toggle — buckle should always appear in Components

## Specs Export Improvements (May 2026)
- [x] Export as A4 landscape
- [x] Max 7 colour columns per block on same sheet (ROXIE format), second block below first
- [x] Wrap text in cells, use space efficiently — single column per colour
- [x] Matched ROXIE format: label col 30 + 7 × 12 colour cols = A4 landscape fit

## Drag-and-Drop Row Reordering in Specs Tab (May 2026)
- [x] Install @dnd-kit/core and @dnd-kit/sortable
- [x] Wrap custom spec rows in a SortableContext per section
- [x] Add drag handle icon to each custom row
- [x] On drag end, persist new sortOrder values to DB via batch upsert

## Add Style to Last feature (May 2026)
- [x] Add custom_styles DB table (style, last, category, createdAt) and push migration
- [x] Add server-side tRPC procedures: customStyle.getAll, customStyle.add, customStyle.delete
- [x] Update useCustomSkus hook to include custom styles in mergedStyles (so they appear in all tabs)
- [x] Add "Add Style" UI inside each last's expanded section in LastApprovalTab with drag-and-drop image upload
- [x] Custom styles should support image upload (reuse styleImage.upload tRPC procedure)

## Add Style to By Style Tab (May 2026)
- [x] Add "Add Style" button in By Style tab toolbar
- [x] Modal with style name, last selector (from all known lasts), category selector, drag-and-drop image upload
- [x] Custom style appears in grouped-by-last table immediately after adding
