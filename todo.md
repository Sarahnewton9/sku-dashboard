
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
- [x] Add sendChangesReport tRPC procedure that sends formatted HTML email to team (fatih, amanda, anthony, alison, sarah.newton @tonybianco.com)
- [x] Add "Send to Team" button to Changes Report modal
- [x] Email body: session name, date, three sections (Cancelled Styles, Cancelled Colours, New Colours Added) as HTML tables

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

## Custom Style Flow-through Fix (May 2026)
- [x] Fix FittingTab: custom styles (_isCustomStyle) now always appear in style list regardless of last name (were filtered out by NEW_LASTS check)
- [x] Fix SpecsTab: custom styles now always appear in baseStyleList regardless of last name, even with 0 colours

## Specs Tab Custom Row UX Fixes (May 2026)
- [x] Remove insert-between-rows ghost rows from SortableCustomRow (keep only Add Row at bottom of each section)
- [x] Fix drag-and-drop reorder: add optimistic update so rows move immediately without snapping back

## Delete SKU Colour Column in Specs Tab (May 2026)
- [x] Add spec_hidden_columns DB table (styleKey, colourKey) to store hidden columns per style
- [x] Add server-side tRPC procedures: getHiddenColumns, hideColumn, showColumn
- [x] Add × delete button on each colour column header in SpecsTab
- [x] Filter out hidden columns from the rendered spec grid (export still includes all columns)
- [x] Sync: cancelled SKUs from By Style tab are already hidden in Specs via cancelledSkuSet filter

## Dynamic Horizontal Scrollbar in Specs Tab (May 2026)
- [x] Replace bottom-of-page horizontal scrollbar with a phantom sticky scrollbar at the bottom of the right panel
- [x] Phantom scrollbar mirrors the table scroll position (bidirectional sync via useLayoutEffect)
- [x] Phantom scrollbar is a sibling outside the overflow-y-auto body, always visible at the bottom of the pane
- [x] Fix Dashboard.tsx: change h-screen to 100dvh to properly constrain layout to visible viewport

## By Style Filter Panel (Jun 2026)
- [x] Add filter panel with Sample Status, Last, Leather, Size 11 filters
- [x] Filters button with active count badge; Clear filters button when any filter active
- [x] Action toolbar buttons (Import, Import Invoice, Export Excel, Add Style, Sync Size 11) made visible

## Spec Bugs (Jun 2026)
- [x] Fix spec values not saving when selecting dropdown option or typing free text
- [x] Fix spec export order — export must follow the on-screen unified row order (drag-drop + saved rowKeys)
- [x] Fix spec export — deleted rows must be excluded from export (currently still appear)

## Per-Colour Custom Row Editing (Jun 2026)
- [x] Add upsertCustomRowForColour DB helper: explode __all__ row into per-colour rows, then update specific colour
- [x] Add specCustomRow.upsertForColour tRPC procedure
- [x] Update UnifiedCustomRow to pass colour key to onUpdate per cell
- [x] Update handleUpdateCustomRow to call upsertForColour with colour key
- [x] Update exportSpecSheet to read per-colour custom row values (by colour key, not __all__)

## Spec Issues Round 2 (Jun 2026)
- [x] Custom row options not persisting — new typed values should be saved as dropdown options for reuse; add delete-option button
- [x] Drag-reorder not saving for export — rowKeys not being saved after drag, export uses wrong order
- [x] Export column widths too narrow — set explicit column widths in ExcelJS

## Spec Critical Bugs (Jun 2026 - custom rows)
- [x] Spec row labels on left always proper-cased (e.g. "Upper 1" not "UPPER 1")
- [x] Custom row value not copying across all colours on first entry (__all__ explosion broken)
- [x] Custom rows not appearing in export
- [x] Delete custom row only clears cell values instead of removing the entire row

## Reset Colour Column in Specs (Jun 2026)

- [x] Add resetColourColumn DB helper: clears all spec_values for a style+colour, and clears all per-colour custom row values for that colour (set value to '')
- [x] Add specValues.resetColour tRPC procedure
- [x] Add Reset button (with confirm popover) to each colour column header in SpecsTab
- [x] After reset, invalidate rawCustomRows and spec values queries

## Spec Export Fix - All Colour Values (Jun 2026)
- [x] Fix spec export only showing first two colour values for custom rows — was using filtered (hidden-columns-excluded) colour list for explosion; now uses full unfiltered list

## Reset Colour Column in Specs Tab (Jun 2026)
- [x] Add resetSpecColour DB helper: delete all style_specs rows + clear custom row values for a colour
- [x] Add specs.resetColour tRPC procedure
- [x] Add Reset (↺) button to colour column header with confirmation prompt
- [x] Clicking reset clears all template spec values and custom row values for that colour column

## Unlimited Text in Spec Cells (Jun 2026)
- [x] Expand specDropdownOptions.value DB column from varchar(256) to text (no character limit)
- [x] Replace single-line input in FreeTypeCell and CustomFreeTypeCell with auto-growing textarea
- [x] Remove text truncation from dropdown option suggestions so long values display fully

## Reset Colour Column in Specs (Jun 2026)

- [x] Add resetColourColumn DB helper: clears all spec_values for a style+colour, and clears all per-colour custom row values for that colour (set value to '')
- [x] Add specValues.resetColour tRPC procedure
- [x] Add Reset button (with confirm popover) to each colour column header in SpecsTab
- [x] After reset, invalidate rawCustomRows and spec values queries

## Manage Saved Dropdown Options (Jun 2026)
- [x] Add specDropdownOptions.update tRPC procedure (rename a saved option value)
- [x] Add specDropdownOptions.delete tRPC procedure (remove a saved option by id)
- [x] Add "Manage options" gear/settings icon in the dropdown suggestion list
- [x] Build ManageOptionsPanel: list all saved options for a row with inline edit (pencil) and delete (trash) per item
- [x] After edit/delete, invalidate specDropdownOptions query and refresh open dropdown list

## Spec Status System (Not Started / In Progress / Complete) (Jun 2026)
- [x] Add specStatus column to spec_meta table (enum: not_started, in_progress, complete), default not_started
- [x] Run pnpm db:push to apply migration
- [x] Add setSpecStatus tRPC procedure (manual override)
- [x] Include status in specMeta query response
- [x] Replace progress bar in style list with status badge (grey/amber/green)
- [x] Add status badge + manual toggle dropdown to spec sheet header
- [x] Auto-complete logic: after every upsert, check if all cells filled → promote to complete; if any cell cleared → demote to in_progress
- [x] Manual override always available (can set back to not_started or in_progress)

## Specs Tab Bug Fixes (Jun 2026)
- [x] Fix: add "Restore cancelled colours" panel in Specs tab so deleted colours can be re-added without knowing the name
- [x] Fix: duplicate colour key bug (e.g. XENA BLACK TUSCON appearing twice) — deduplicate colour iteration in NEW_COLOURS_PER_STYLE so each colour is only processed once even when it appears with multiple leathers in custom_skus

## Bulk Spec Status Update (Jun 2026)
- [x] Add bulkSetSpecStatus DB helper and tRPC procedure
- [x] Add checkbox selection UI to style list + bulk action toolbar (Complete / In Progress / Not Started)

## Custom Row Bugs (Jun 2026)

- [x] Fix: custom row drops to bottom after being moved — temp id in localRowKeys not swapped for real id after server responds; addCustomRowMutation.onSuccess now calls swapLocalRowKey to update SpecForm's localRowKeys in-place
- [x] Fix: custom row copy not working across colours — allColours explosion was using raw colour codes (e.g. "BLACK") instead of full colour labels (e.g. "BLACK CAPRI"); fixed to use colourLabels so explosion keys match spec storage keys
- [x] Fix: upsertForColourMutation explosion now also calls swapLocalRowKey so localRowKeys stays correct after __all__ row is replaced by per-colour rows

## Trend Filter (Jun 2026)
- [x] Parse trend data from SS26 spreadsheet columns G & H (26 styles, 4 trends: BALLET, MESH, TOE CAP, ROSETTE)
- [x] Add trends column to style_trend_flags DB table (nullable TEXT, JSON array)
- [x] Import all 26 style-trend mappings into DB via migration script
- [x] Update getAllStyleTrendFlags to parse JSON trends array
- [x] Add upsertStyleTrends and deleteStyleTrends DB helpers
- [x] Add trendFlag.upsert and trendFlag.delete tRPC procedures
- [x] Update useStyleCategories hook to expose getTrends() and allTrends
- [x] Add trendFilter state to StylesTab
- [x] Wire trendFilter into filtered useMemo
- [x] Add Trend filter chips to More Filters panel
- [x] Update More Filters badge count and Clear filters to include trendFilter
- [x] Show clickable trend badges on each style row (clicking filters by that trend)

## Trend Filter Improvements (Jun 2026)
- [x] Add LOAFER styles to migrate-trends.mjs import mapping so re-imports preserve LOAFER
- [x] Change trendFilter state from single string to string[] array for multi-select
- [x] Update filtered useMemo to match styles where trends intersect with selected trend array
- [x] Show style count on each trend chip (e.g. "BALLET (14)")
- [x] Update filter chips UI to support multi-select toggle (add/remove from array)
- [x] Update More Filters badge count and Clear filters to work with array

## Last Measurements Feature (Jun 2026)
- [x] Add last_measurements DB table (last, type: LENGTH|GIRTH, size, value)
- [x] Seed 7 lasts × 12 sizes × 2 types from image data
- [x] Add tRPC getLastMeasurements procedure
- [x] Build LastMeasurementsPanel component (full table, Size 7 highlighted)
- [x] Add Measurements button to Fitting tab toolbar opening the panel
- [x] Make last name clickable in By Style to show that last's measurements

## Markdown Scanner Feature (Jun 2026)
- [x] Add markdown_skus DB table (style, colour, source_url, flagged_at, status: pending|deleted|restored)
- [x] Add scraper server function to fetch all sale products from tonybianco.com.au Shopify API
- [x] Add tRPC procedures: scanMarkdowns, getMarkdownSkus, bulkDeleteMarkdowns, restoreMarkdown
- [x] Add /api/scheduled/markdown-scan Express handler for Heartbeat
- [x] Build Markdown review page with bulk select/delete/restore
- [x] Add scan button with confirmation popup showing matched SKUs before flagging
- [x] Filter markdown SKUs out of By Style and By Category tabs
- [x] §5c patches not needed — §4a project-level Heartbeat does not require cron auth patches
- [x] Register weekly Heartbeat schedule — task_uid: cW4pFgYKXTVRJHDHCi3KeY, runs Mondays 02:00 UTC

## Handbags Section (Jun 2026)
- [x] Create handbag_styles, handbag_buy_sessions, handbag_buy_items DB tables
- [x] Seed 30 colourways across 12 styles from SS26 linesheet (names and colours only)
- [x] Add handbag tRPC router with listStyles, upsertStyle, deleteStyle, listSessions, createSession, deleteSession, listBuyItems, upsertBuyItem, deleteBuyItem
- [x] Build HandbagsTab component with By Style view (colour, material, RRP, cost, buy totals) and Buy view (session selector, inline qty entry per AU/USA/NYC)
- [x] Add /handbags route and Handbags nav item to Dashboard

## Sales Analysis Tab (Jun 2026)
- [x] Add sales_snapshots DB table (id, name, createdAt) and sales_data rows (snapshotId, style, colour, units)
- [x] Add sales tRPC router: listSnapshots, createSnapshot (with parsed rows), deleteSnapshot, getSnapshot
- [x] Build parser for tab-indented paste format (style header rows vs colour/qty rows)
- [x] Build SalesTab UI: paste input modal, snapshot selector, style breakdown table with colourway rows, buy qty comparison column
- [x] Add /sales route and Sales nav item under Analysis group in Dashboard sidebar

## Handbags Export (Jul 2026)
- [x] Add Export button to Handbags tab header
- [x] Export all colourways to Excel (STYLE, COLOUR, MATERIAL, SECTION, RRP, COST, AU BOUGHT, USA BOUGHT)
- [x] Style name only shown on first colourway row (bold), subsequent rows blank for readability
- [x] Styled with dark header row, dated filename (Handbags_SS26_DD-MM-YYYY.xlsx)

## Handbags Layout Improvements (Jul 2026)
- [x] Separate bought vs unbought colourways — styles with any buy qty appear in "Bought" section, others in "New Season" section
- [x] Larger colourway images (112×112px / w-28 h-28) to match Flora-style display
- [x] Style-level header image (smaller, 64×40px) on collapsed row
- [x] Add colour button inside buy session — same inline flow as footwear
- [x] Buy session bar inline in HandbagsTab (no lock/unlock, simpler than footwear)
- [x] Session-level qty entry per colourway with AU/USA/NYC columns
- [x] All-sessions total always visible per colourway
- [x] Grand total summary bar below session bar
