# SKU Dashboard TODO

## Phase 1: Full-stack upgrade
- [x] Upgrade project to web-db-user template
- [x] Create database schema: skuMeta, styleMeta, fittingImages tables
- [x] Run pnpm db:push to sync schema

## Phase 2: Backend API
- [x] sku.getAll — fetch all SKU metadata
- [x] sku.update — upsert SKU metadata (sample status, order qty, size 11, cost, fit rating, fitting notes)
- [x] sku.importCosts — bulk import cost prices from Excel
- [x] style.getAll — fetch all style metadata (RRP)
- [x] style.importRrp — bulk import RRP from Excel
- [x] fitting.getImages — get fitting images for a SKU
- [x] fitting.uploadImage — upload image to S3 and save reference
- [x] fitting.deleteImage — delete fitting image
- [x] fitting.getAllImages — get all fitting images

## Phase 3: Frontend UI
- [x] SkuDetailPanel — slide-out panel with sample status, order qty, size 11, cost, RRP, fit rating, fitting notes, fitting images
- [x] StylesTab — expandable rows to show SKUs, click to open SkuDetailPanel
- [x] ImportPanel — import cost prices and RRP from Excel with preview
- [x] SummaryCards — "Waiting on X samples" and "Samples Received" tiles (live from DB)
- [x] LeathersTab — leather usage calculator with footage estimates

## Phase 4: Exports
- [x] ExportPanel — fitting notes export (factory-ready), buy sheet export, full data export
- [x] Export button in Dashboard header

## Phase 5: Wiring & Polish
- [x] All live counts wired to DB (sample status tiles)
- [x] TypeScript compilation clean (no errors)
- [x] Vitest tests for key procedures
- [x] Checkpoint saved

## Phase 6: Buy Sessions + Inline Qty + Leather Combos

### Database / Backend
- [x] Add buySession table: id, name, date, isLocked, createdAt
- [x] Add buySessionItem table: sessionId, style, colour, leather, qty
- [x] DB push for new tables
- [x] backend: buySession.create (creates new active session)
- [x] backend: buySession.getAll (list all sessions)
- [x] backend: buySession.getItems (get all items for a session)
- [x] backend: buySession.upsertItem (set qty for a SKU in a session)
- [x] backend: buySession.lock (lock a session, prevent further edits)
- [x] backend: buySession.getActive (get current unlocked session)

### Inline Buy Qty Editing
- [x] Expanded style rows show inline qty input per SKU (linked to active buy session)
- [x] Qty auto-saves on blur/enter
- [x] Show session name/date above the expanded rows

### Buy Session Management UI
- [x] Buy Sessions panel/tab: list all sessions with date, name, total pairs, locked status
- [x] Create new session button (with date picker and optional name)
- [x] Lock session button (confirms, prevents further edits)
- [x] Export session as Excel (only items in that session with qty > 0)
- [x] View session items (read-only for locked sessions)

### Buy Analysis Tab
- [x] New "Buy Analysis" section or tab
- [x] Summary: total pairs bought per session
- [x] Breakdown by category (pairs per category)
- [x] Breakdown by leather (pairs per leather)
- [x] Breakdown by colour/leather combination (pairs per combo, new SKUs only)
- [x] Selector to choose which session to analyse

### Leather Calculator Fix
- [x] Change leather calculator to show colour+leather combinations (not just leather)
- [x] Filter to new SKUs only by default (carry-over styles don't need fresh leather orders)
- [x] Footage calculation per colour+leather combo

## Phase 7: Data Corrections + UX Fixes

- [x] Size 11 toggle: move to style-level (toggling one SKU toggles all SKUs on that style)
- [x] By Style: group styles by last name (alphabetical by last, then by style within last)
- [x] Cappa – Petal Nappa: mark as new
- [x] Cappi – Turquoise Suede: mark as cancelled
- [x] Caspian – Willow Nappa: mark as cancelled
- [x] Celeste – remove duplicate Silver Nappa Metallic
- [x] Cuba – Willow Nappa: mark as cancelled
- [x] Curious – Willow Nappa: mark as cancelled
- [x] Curious – Vanilla Nappa: mark as new colour
- [x] Curious – add missing Willow Nubuck
- [x] Dazie – Choc Vintage → rename to Choc Venice
- [x] Dazie – Taupe Suede: mark as cancelled
- [x] Dazie – Espresso Suede: mark as cancelled
- [x] Dazie – Mint Croco: mark as cancelled
- [x] Dazie – Red Croco: mark as cancelled
- [x] Donte – add missing Black Speckle
- [x] Eliza – Black Nappa Patent: mark as cancelled
- [x] Eliza – Stone Nappa Patent: mark as cancelled
- [x] Envy – Petal Croco: mark as cancelled
- [x] Envy – Red Croco: mark as cancelled
- [x] Envy – add Petal Nappa
- [x] Kassy – Blush Nubuck: mark as new
- [x] Kassy – Sky Nubuck: mark as cancelled
- [x] Kassy – Black Nubuck: mark as cancelled
- [x] Kimba – fix duplicate Black Nappa (one should be Black Patent)
- [x] Legacy – add missing Petal Nappa Patent
- [x] Legacy – add missing Turquoise Nappa Patent
- [x] Lucy – mark all colours as new
- [x] Maddi – Willow Nappa: mark as cancelled
- [x] Marameo – mark all colours as new
- [x] Matisse – Fuchsia Nubuck: mark as cancelled
- [x] Matisse – mark all colours as new
- [x] Molly – Vanilla Vintage: not present in data (no action needed)
- [x] Paris – mark all colours as NOT new
- [x] Robyn – mark all colours as new
- [x] Robyn – fix duplicate Black Suede → Black Nappa + Black Speckle (remove Black Suede)
- [x] Add new style SAMSON on Sally last: Black Vintage + Peru Nappa (all new)
- [x] Sia – Black Kid: mark as cancelled
- [x] Sia – Petal Suede, Sky Suede, Espresso Suede, Wheat Suede: all cancelled
- [x] Trevi – Black Suede, Petal Suede, Taupe Suede: all cancelled
- [x] Violet – mark all colours as NOT new

## Phase 8: UX Simplification + Last Approval + Sqft Fix

- [x] Expanded SKU rows: show only New/Existing status, Size 11, Sample status, Buy Qty
- [x] Buy Qty input only shown for NEW SKUs in expanded rows (existing SKUs show read-only)
- [x] Fit rating, cost, notes etc. remain in the slide-out detail panel only
- [x] Add "Last Approval" section/tab: each last with status (Approved / Waiting on Revised)
- [x] Fix sqft calculations: Dress Sandal=2.15, Court Shoe=2.35, Ankle Boot=3.6, Calf Boot=6.95, Sandal=2.0
- [x] Investigate Tony Bianco RRP scraping from tonybianco.com.au
- [x] Implement RRP scraping via Shopify products.json API — "Fetch RRP from Tony Bianco AU" button in Export panel

## Phase 9: Session Delete + RRP Import + Overview Cleanup

- [x] Backend: buySession.delete — delete session and all its items
- [x] BuySessionsPanel: add delete button per session row with confirmation
- [x] ImportPanel: RRP import tab already existed — confirmed working
- [x] Fix RRP display in SkuDetailPanel — confirmed correct, data needs to be imported first
- [x] SummaryCards: remove Unique Leathers and Unique Colours tiles

## Phase 10: Season Analysis Tab (DONE)

### Database / Backend
- [x] Add seasonImports table: id, label, uploadedAt, rowCount
- [x] Add seasonSkuData table: importId, style, colour, leather (derived), totalUnitsSold, lastWeekUnits, lastWeekSellThru, avgWeeklySellThru, auOrigPrice, subCategory, stdSellThru, totalSoh
- [x] DB push for new tables
- [x] Backend: season.import — parse uploaded Excel rows, save to DB
- [x] Backend: season.getAll — list all imports
- [x] Backend: season.getData — get all rows for an import
- [x] Backend: season.delete — remove an import and its rows

### Frontend
- [x] Season Analysis tab in sidebar under Analysis group
- [x] Import button: upload .xlsm/.xlsx, optional label, parse client-side, save to DB
- [x] Import history: list previous uploads with date/label and delete option
- [x] Hot Sellers section: existing styles with strong sales but no new SKUs this season
- [x] Colour Insights section: colours with highest avg sell-through, flagged if in/out of current range
- [x] SKU Coverage table: all matched styles with last-season units + sell-thru + new/existing SKU counts, expandable to show individual SKU rows
- [x] TypeScript clean, all 8 tests pass

## Phase 11: Last Approval Notes Import

- [x] Last Approval tab: add Excel import button (columns: Last, Notes, optional Status)
- [x] Parse uploaded Excel client-side, preview matched rows before committing
- [x] On confirm: upsert notes (and optionally status) for each matched last via existing lastApproval.upsert route
- [x] Show unmatched last names in the preview so user can spot typos

## Phase 12: Approval Section Restructure

### Database / Backend
- [x] Add fitRating, fittingNotes fields to styleMeta table (style-level fit data)
- [x] Add styleFittingImages table: id, styleName, imageUrl, fileKey, createdAt
- [x] DB push for new tables
- [x] Backend: styleFitting.updateFit — upsert fitRating + fittingNotes for a style
- [x] Backend: styleFitting.uploadImage — upload image to S3, save to styleFittingImages
- [x] Backend: styleFitting.getImages — get all images for a style
- [x] Backend: styleFitting.deleteImage — delete a fitting image by id

### Frontend
- [x] Rename "LASTS" sidebar section to "APPROVAL"
- [x] Add "Fitting" sub-tab alongside "Last Approval" in the Approval section
- [x] Fitting tab: flat list of all styles on the 16 new lasts, grouped by last
- [x] Each style row: expand to show fit rating dropdown, fitting notes textarea, image upload/gallery
- [x] Fitting tab: Export button — opens modal with Fit Model + Date fields, generates HTML for print-to-PDF
- [x] HTML export: style image + style name + last + fit rating + notes, one style per section
- [x] Export only includes styles with at least a fit rating or notes filled in
- [x] Remove fit rating, fitting notes, fitting images from SkuDetailPanel

## Phase 13: Fit Approval Status + By Style Integration

### Database / Backend
- [x] Add fitApproved boolean field to styleMeta table
- [x] DB push for schema change
- [x] Backend: update styleFitting.updateFit to accept fitApproved flag
- [x] Backend: style.getAll already returns styleMeta — fitApproved included

### Frontend — Fitting Tab
- [x] Add "Approve Fit" button to each style row in Fitting tab
- [x] Approved styles collapse into a "Approved (N)" section at the bottom of the Fitting tab
- [x] Approved section is collapsed by default, expandable to view/edit approved styles
- [x] Approved styles show an "Undo Approval" button to move them back to active list
- [x] Fit data (rating, notes, images) remains fully editable regardless of approval status

### Frontend — By Style Tab
- [x] When a style row is expanded and the style has been fit-approved, show fit badge + notes inline above the SKU list
- [x] Fit badge shows the fit rating (TTS / Runs Small / Runs Large) in the appropriate colour
- [x] Fitting notes shown as italic text below the badge
- [x] Only show fit info for styles that have fitApproved = true

## Phase 14: Fitting Tab — All New Styles

- [x] Change FittingTab to include ALL styles with at least one new SKU (not just styles on new lasts)
- [x] Group by last name (alphabetical) as before
- [x] Update header description to reflect the broader scope

## Phase 15: Fitting Tab — Correct Filter Logic

- [x] Filter: show styles on a new last (last name in NEW_LASTS list) OR styles where isAllNew=true (brand new pattern, all SKUs new)
- [x] Styles on existing lasts with only some new SKUs (e.g. Breeze) are excluded

## Phase 16: Fit Approved — Move to By Style Tab

- [x] FittingTab: remove the collapsed "Approved" section at the bottom — approved styles no longer appear in Fitting at all
- [x] FittingTab: update header count to show only pending styles
- [x] StylesTab: add a collapsed "Fit Approved (N)" section at the bottom of the By Style tab
- [x] Each approved style in that section is expandable to show fit rating badge, fitting notes, and fitting images
- [x] Approved styles can still have their approval undone from the By Style section (moves them back to Fitting tab)

## Phase 17: Fitting Tab Search

- [x] Add search input to Fitting tab header area
- [x] Filter active styles by search query (style name, last name)
- [x] Show match count when search is active

## Phase 18: Specs Section

- [x] DB: styleSpecs table — id, style, colour, component, value, updatedAt
- [x] DB: specDropdownOptions table — id, component, value, createdAt (stores custom dropdown values per field)
- [x] DB push for new tables
- [x] Backend: specs.getForStyle(style) — returns all saved component values for a style grouped by colour
- [x] Backend: specs.upsert({ style, colour, component, value }) — save one cell
- [x] Backend: specs.getDropdownOptions(component) — return saved options for a field
- [x] Backend: specs.addDropdownOption({ component, value }) — add a new option
- [x] Shared: spec templates per category (component rows, order) — Dress Shoe (Court/Sling), Ballet Flat, Loafer, Platform, Boot, Sandal, Wedge
- [x] Shared: default dropdown options per component (pre-seeded from spec sheets)
- [x] Buckle toggle Y/N on every template — when Y, shows Buckle Colour dropdown per colour
- [x] SpecsTab: style list on left (new patterns only, same filter as Fitting tab)
- [x] SpecsTab: clicking a style loads spec form on right
- [x] SpecsTab: per-colour columns (one column per colour in the style)
- [x] SpecsTab: editable dropdown cells — type to add new option, saved to DB
- [x] SpecsTab: free-text Notes field per style
- [x] SpecsTab: Copy From button — duplicate one colour's values to all others
- [x] SpecsTab: completion indicator per style (e.g. filled / empty)
- [x] Excel export: generates spec sheet matching factory format (header rows + component rows + colour columns)
- [x] Sidebar: add Specs nav item under Approval section

## Phase 19: Spec Sheet Export — Image

- [x] Fetch style image as base64 in the browser before export
- [x] Embed image into Excel using ExcelJS addImage
- [x] Image appears in the header area of the spec sheet (top-right, alongside style name/last/season)

## Phase 20: Spec Import + Key Fix

- [x] Fix missing key prop warning in SpecForm (add key to mapped elements)
- [x] Add Import button to Specs tab header
- [x] Parse uploaded factory spec sheet Excel (component in col A, colours in subsequent cols)
- [x] Map parsed component labels to internal component keys using fuzzy matching
- [x] Save parsed values to DB via specs.upsert (overwrite existing)
- [x] Show import summary (X components imported for Y colours)

## Phase 21: Fix Image in Spec Export

- [x] Add server-side /api/image-proxy?url=... endpoint to fetch CDN images and return them (avoids CORS)
- [x] Update exportSpecSheet.ts to fetch image via /api/image-proxy instead of direct CDN fetch

## Phase 22: Fitting Sessions, Image Updates, Spec Copy & Export Formatting

### Image Updates (all tabs)
- [x] DB: styleImageOverride table — style, imageUrl, fileKey, createdAt
- [x] Backend: styleImage.upload — upload image to S3, save override, return url
- [x] Backend: styleImage.revert — delete override, return original CDN url
- [x] Backend: styleImage.getAll — get all image overrides
- [x] UI: "Update Image" button on style header in Specs tab
- [x] UI: clicking Update Image opens file picker, uploads, replaces image in Specs
- [x] UI: "Revert to original" link shown when override exists

### Fitting Sessions
- [x] DB: fittingSessions table — id, style, fitModel, sessionDate, notes, createdAt
- [x] DB: fittingSessionImages table — id, sessionId, imageUrl, fileKey, createdAt
- [x] DB push for new tables
- [x] Backend: fittingSession.create({ style, fitModel, sessionDate, notes })
- [x] Backend: fittingSession.getForStyle(style) — list all sessions with images
- [x] Backend: fittingSession.update({ id, fitModel, sessionDate, notes })
- [x] Backend: fittingSession.delete(id)
- [x] Backend: fittingSession.uploadImage({ sessionId, base64, mimeType }) — upload to S3, link to session
- [x] FittingTab: replace flat image upload with session-based UI
- [x] FittingTab: "Add Fitting Session" button — opens form for fit model name + date
- [x] FittingTab: each session shows model name, date, image gallery with lightbox
- [x] FittingTab: lightbox — click image to open full-screen overlay
- [x] FittingTab: export modal — choose which session to export by date
- [x] Fitting export report: shows session model name, date, images, fit rating, notes

### Spec Copy (selective colour-to-colour)
- [x] Remove "Copy all specs from X → all others" button
- [x] ColourCopyPanel: select source colour from dropdown
- [x] ColourCopyPanel: tick target colours to copy to
- [x] User ticks target colours, clicks Copy — copies all component values from source to selected targets

### Spec Export Formatting
- [x] Analyse MOMA spec sheet exact formatting (font name, sizes, bold rows, colours, borders)
- [x] Rewrite exportSpecSheet.ts: Arial throughout, bold rules, no coloured backgrounds, blank spacer rows, 2-col merged colour columns
- [x] Ensure style image is embedded correctly in header area (top-right, rows 1-8)

## Phase 23: Spec Colour Column Headers

- [x] SpecsTab: show full colour+leather name as column header (e.g. "DOVE NAPPA") instead of "COLOUR 1"
- [x] exportSpecSheet.ts: use full colour+leather name in colour column headers

## Phase 23 Bug Fix: Spec Import Colour Key Mismatch

- [x] Fix: imported specs were saved with full colour+leather label (e.g. "DOVE NAPPA") instead of raw colour key ("DOVE"), causing them not to display in the spec grid
- [x] Fix: handleSaveImport now maps full labels back to raw colour keys using COLOUR_LEATHER_MAP reverse lookup
- [x] Fix: add uniqueIndex on (style, colour, component) to style_specs table so onDuplicateKeyUpdate works correctly and prevents duplicate rows
- [x] DB: run pnpm db:push to apply unique index migration
- [x] DB: clean up existing bad data (CAPPA rows with full-label colour keys migrated to raw colour keys, duplicates removed)

## Phase 24: Spec Dropdown UX Improvements

- [x] Spec dropdowns: replace plain Select with searchable combobox (Popover + Command) — type to filter options
- [x] Spec dropdowns: sort all options alphabetically (defaults + saved options merged and sorted)
- [x] Upper 1 field: auto-fill with the colour+leather label for that column (e.g. "DOVE NAPPA") — pre-filled on first load, still editable
- [x] Upper 1 field: build its options list from all real colour+leather combos in skuData.rawSkus (not the hard-coded defaults)

## Phase 25: Spec Sidebar Completed Section

- [x] Split spec sidebar into two collapsible groups: "In Progress" (open by default) and "Completed" (collapsed by default)
- [x] Styles move to Completed group when completion percentage reaches 100%
- [x] Completed group shows count badge (e.g. "Completed (12)")
- [x] In Progress group shows count badge (e.g. "In Progress (35)")

## Phase 26: Edit/Delete Fitting Comments

- [x] User confirmed edit/delete fitting comments already works — no changes needed

## Phase 26: Buy Sheet Export Column Order

- [x] Buy sheet export: move Last column before Style Name column

## Phase 27: Cancel Style Feature

- [x] DB: add cancelled_styles table (style text, cancelledAt timestamp)
- [x] Server: add styles.cancel, styles.restore, styles.listCancelled tRPC procedures
- [x] Client: add useCancelledStyles hook; filter cancelled styles from By Style view
- [x] By Style: add Cancel button per style row (Ban icon, with confirm dialog)
- [x] Add Cancelled Styles section at bottom of By Style tab (collapsed, with Restore button per style)
- [x] Filter cancelled styles from Fit Approved section in By Style tab

## Phase 28: Buying Improvements (superseded — see Phase 28 v2 below)

- [x] Server: add buy.unlockSession procedure (sets isLocked = false)
- [x] BuySessionBar / BuySessionsPanel: add Unlock button on locked sessions with confirmation
- [x] Server: add buy.addCustomSku procedure — saves a custom colour/leather combo for a style into a new customSkus table
- [x] DB: add customSkus table (id, style, colour, leather, createdAt)
- [x] DB push for new table
- [x] StylesTab: in expanded style rows (when session is unlocked), show "Add Colour" button at the bottom of the SKU list
- [x] "Add Colour" opens an inline form: colour text input + leather text input + confirm
- [x] Custom SKUs appear in the expanded row with a buy qty input (treated as new SKUs)
- [x] Custom SKUs also appear in the buy sheet export (included via ExportPanel allSkus merge)

## Phase 28: Buying Improvements — Unlock Session + Add Custom SKU

- [x] DB: add customSkus table (id, style, colour, leather, createdAt)
- [x] DB push for new table
- [x] Server: add customSku.add, customSku.getAll, customSku.delete tRPC procedures
- [x] Server: add buy.unlock procedure (sets isLocked = false)
- [x] Client: create useCustomSkus hook — fetches all custom SKUs, merges into skuData at runtime
- [x] By Style (StylesTab): uses mergedStyles + mergedRawSkus from useCustomSkus hook
- [x] StylesTab: "Add colour" button at bottom of expanded style rows (only when session is unlocked)
- [x] "Add colour" inline form: colour + leather inputs, confirm adds to DB and buy session
- [x] Custom SKUs marked as new automatically
- [x] BuySessionBar: Unlock button on locked sessions with confirmation; Lock button hidden when already locked

## Phase 29: Buying & Category Improvements

- [x] AU/USA qty split: add auQty + usaQty columns to buy_session_items table (replace single qty)
- [x] AU/USA qty split: update server procedures (upsertSessionItem, getSessionItems) for dual qty
- [x] AU/USA qty split: update StylesTab buy qty UI to show two inputs (AU / USA) side by side
- [x] Multi-session buy analysis: allow selecting multiple sessions in BuyAnalysisTab (checkbox multi-select)
- [x] SKU-level cancel: add cancelled_skus DB table (style, colour, leather, cancelledAt)
- [x] SKU-level cancel: add server procedures (cancelSku, restoreSku, listCancelledSkus)
- [x] SKU-level cancel: add Cancel button per SKU row in StylesTab expanded rows
- [x] SKU-level cancel: add Cancelled SKUs section (restorable) at bottom of StylesTab
- [x] Buy export: update to columns: Category, Style, Colour, Leather, AU Units, USA Units
- [x] Ballet/Loafer: change from category to trend flag (new trendFlag field on style meta)
- [x] Ballet/Loafer: update By Style view to show CASUAL FLAT as category + trend flag badge
- [x] Wedge/Boot sub-categories: add sub-category override table in DB + seed from user Excel
- [x] Wedge/Boot sub-categories: apply in By Style view via useStyleCategories hook
- [x] useStyleCategories hook: fetches sub-categories + trend flags, provides getCategory/getTrendFlag
- [x] BuyAnalysisTab: AU/USA split in summary cards + bar charts (amber=AU, blue=USA)
- [x] BuyAnalysisTab: runtime category overrides via useStyleCategories hook

## Phase 30: Buy Export Size 11 Column

- [x] Buy export: add Size 11 (Y/N) column after Leather

## Phase 31: Buy Export Exact Format

- [x] Buy session export: filename = "SUMMER 26 BUY DD.MM" (season + today's date)
- [x] Buy session export: columns = LAST, SIZE 11 (Y/N), STYLE, COLOUR, LEATHER, AU QTY, US QTY
- [x] Buy session export: sheet name = "Buy Sheet"
- [x] ExportPanel buy export: same filename and column format (deferred — main export via Buy Sessions panel)

## Phase 32: Buy Export Formatting

- [x] Buy export: add CATEGORY column (first column, before LAST)
- [x] Buy export: bold header row, Calibri 12, centered, thin borders, column widths matching template

## Phase 33: Category Overrides in Buy Export

- [x] Buy export CATEGORY column: use resolved category (sub-category overrides + CASUAL FLAT for Ballet Flat/Loafer)

## Phase 34: Specs Sync with Cancelled Styles and Custom SKUs

- [x] SpecsTab: filter out cancelled styles from the sidebar list
- [x] SpecsTab: merge custom SKU colours into the spec columns for each style (so new colours appear as spec columns)

## Phase 35: Fix Disappearing Buy Quantities

- [x] Bug: By Style tab showed "No session selected" on load when there was no active (unlocked) session, causing all buy quantities to appear blank
- [x] Root cause: auto-select logic used `useMemo` (wrong hook for side effects) and only checked for an active session — locked sessions were never auto-selected
- [x] Fix: replaced `useMemo` with `useEffect`; now falls back to the most recently created session if no active session exists

## Phase 36: Buy Export — Session Date + Presentation Formatting

- [x] Buy export filename: use session's own date (from session.createdAt or session.name) instead of today's date
- [x] Buy export: redesign layout to be clean and presentation-ready (title row, styled header, alternating rows, category grouping with subtotals, totals row)

## Phase 37: Auto-fill Size 11 from tonybianco.com.au

- [x] Scrape tonybianco.com.au product pages to check which styles are available in size 11
- [x] Add server-side tRPC procedure: sku.fetchSize11FromTonyBianco — fetches all product pages, uses available:size:11 / hidden:size:11 tags
- [x] Add "Sync Size 11" button in By Style tab filter bar
- [x] On click: calls scrape procedure, bulk-updates isSize11 for all matched styles, shows toast with results

## Phase 38: By Style UX Fixes + Custom SKU Propagation

- [x] Size 11: only show a positive badge on styles that have size 11 — nothing shown if they don't
- [x] SKU row layout: split expanded style into two sections — Existing (colour/leather/size11) and New (colour/leather/size11/sample/buy qty) — with aligned columns and proper spacing
- [x] Add colour: always show the Add Colour button regardless of session state; if no session open, save as custom SKU only; if session open, also add to session
- [x] Custom SKUs: ColourLeatherTab now dynamically merges custom SKUs from DB (same pattern as SpecsTab)

## Phase 39: Session Default = None

- [x] By Style tab: default to no session selected on load (remove auto-select of most recent session)
- [x] Add a "— No session —" option at the top of the session selector dropdown so user can explicitly deselect
- [x] Session selector only shows buy qty inputs when a session is actively selected

## Phase 40: Always Show Buy Qty (Read-Only When No Session)

- [x] When no session is selected, show buy qty as read-only text from the most recent session (so units are always visible)
- [x] When a session is selected and unlocked, show editable inputs as before
- [x] When a session is selected and locked, show read-only text as before

## Phase 41: Show Only Non-Empty Fields in SKU Rows

- [x] Hide USA qty if zero in read-only mode (only show if > 0)
- [x] Hide Sample badge if not received (removed "—" placeholder)
- [x] Size 11 badge only shows when true (already working)
- [x] Column headers retained but empty cells are invisible when no value present

## Phase 42: Fix SIZE 11 in Buy Export

- [x] Buy export SIZE 11 column: now uses styleSize11Map (style-level, derived from skuMeta DB) — if any SKU for a style has isSize11=true, the style shows Y in the export
- [x] Changed from per-SKU lookup (which missed SKUs with no DB row) to style-level lookup so all SKUs for a size-11 style show Y correctly

## Phase 43: Match Buy Export to Reference Spreadsheet

- [x] Analysed reference XLSX: 6 cols (CATEGORY, LAST, SIZE 11, STYLE, COLOUR, AU QTY), merged title A1:F1, plain white rows, no alternating colours, no USA column
- [x] Rewrote exportSession to match reference: combined colour+leather into single COLOUR column, exact column widths and row heights, plain Calibri 12pt, total row at bottom

## Phase 44: Add Cell Colours to Buy Export

- [x] Title row (row 1): solid dark fill (#1A1A1A), white bold font
- [x] Header row (row 3): solid dark fill (#1A1A1A), white bold font
- [x] Data rows: no fill (plain white)
- [x] Total row: no fill, plain text

## Phase 45: Fix Export Cell Colours and USA Column

- [x] Diagnosed: standard xlsx library ignores .s cell styles — switched to xlsx-js-style v1.2.0 (drop-in replacement)
- [x] Cell colours now apply: dark fill (#1A1A1A) + white bold font on title and header rows
- [x] USA QTY column added conditionally — only appears when any USA quantities exist in the session

## Phase 46: By Category — Merge Ballet Flat and Loafer into Casual Flat

- [x] By Category tab: Ballet Flat and Loafer now merged under single CASUAL FLAT card using useStyleCategories hook
- [x] Trend breakdown tags (Ballet Flat / Loafer with style counts) shown on the CASUAL FLAT card and in the comparison table
- [x] SKU counts (new/existing/total) roll up correctly under the merged Casual Flat group

## Phase 47: Specs Tab — Hide Cancelled SKUs from Colour Columns

- [x] SpecsTab: fetches cancelled SKUs via trpc.cancelledSku.list
- [x] Builds cancelledSkuSet of style|colour|leather keys
- [x] Colour columns for each style now exclude individually cancelled SKUs; styles with all colours cancelled are also removed from the sidebar

## Phase 48: Fitting Tab — Hide Cancelled Styles and SKUs

- [x] FittingTab: fetches cancelled styles via trpc.styles.listCancelled
- [x] Filters cancelled styles from the fitting style list using cancelledStyleSet
- [x] Note: FittingTab is style-level only (no per-SKU rows), so cancelled style filter is sufficient

## Phase 49: Fitting Tab — Speed Up Session Loading

- [x] Added getAllFittingSessions DB helper (2 queries: all sessions + all images, then joined in memory)
- [x] Added fittingSession.getAll tRPC procedure on the server
- [x] FittingTab now fetches all sessions in one bulk query and builds a sessionsByStyle map
- [x] StyleFitRowWithSessions now receives preloadedSessions as a prop instead of firing its own per-style query
- [x] Eliminated N+1 query pattern — sessions load in a single round-trip regardless of style count

## Phase 50: Fix Custom SKUs Not Appearing in Specs Tab

- [x] Root cause: deduplication used colour-only Set, so BLACK KID was blocked by existing BLACK VINTAGE
- [x] Fixed: deduplication now uses colour+leather combo key so BLACK KID appears as a separate column from BLACK VINTAGE

## Phase 51: Fix Colour/Leather Tab — Hide Cancelled Styles and SKUs

- [x] ColourLeatherTab: fetches cancelled styles via trpc.styles.listCancelled
- [x] ColourLeatherTab: fetches cancelled SKUs via trpc.cancelledSku.list
- [x] Builds cancelledStyleSet (Set of style names) and cancelledSkuSet (Set of style|colour|leather keys)
- [x] Filters both from allRawSkus before building combos — CIRCA, MAMZELLE and any other cancelled styles/SKUs no longer appear
- [x] TypeScript: 0 errors confirmed via npx tsc --noEmit

## Phase 52: Ensure Cancelled Styles/SKUs Filtered Across ALL Tabs

- [x] Audit CategoryTab — added cancelled style + SKU filters
- [x] Audit LeathersTab — added cancelled style + SKU filters; rebuilt leather counts from filtered rawSkus
- [x] Audit ColoursTab — added cancelled style + SKU filters; rebuilt colour counts from filtered rawSkus
- [x] Audit ExpansionAnalysis — added cancelled style + SKU filters; buildExpansionData now takes filter sets as params
- [x] Audit BuyAnalysis — safe (reads from buy session items DB, not rawSkus directly)
- [x] Apply filters to any tab missing them
- [x] TypeScript: 0 errors confirmed

## Phase 53: AP21 CSV Export

- [x] Add AP21 export button to ExportPanel (per-style selector + generate CSV)
- [x] CSV rows: one per colour per size, ordered style→colour→size per AP21 spec
- [x] Map all required AP21 fields from skuData + skuMeta + styleMeta
- [x] Cancelled styles and cancelled SKUs excluded from AP21 export
- [x] TypeScript: 0 errors confirmed

## Phase 54: PowerPoint Range Review Sync
- [x] Install python-pptx on server and build PPTX parser script
- [x] Build tRPC procedure: upload PPTX → parse → return diff (red SKUs to cancel, purple SKUs to mark specked, missing SKUs)
- [x] Build confirmation modal UI showing the diff before applying
- [x] Build tRPC apply-changes procedure: cancel red SKUs, mark purple SKUs as specked
- [x] Add "Sync from Range Review PPTX" button to ExportPanel
- [x] TypeScript: 0 errors confirmed

## Phase 55: Fix duplicate BLACK key and specs.getMeta undefined
- [x] Find all components using colour name as React key and add index to make unique (BLACK appears in multiple leathers e.g. BLACK NAPPA + BLACK SUEDE)
- [x] Fix specs.getMeta router procedure to return null instead of undefined when no DB record found
- [x] TypeScript: 0 errors confirmed

## Phase 56: Style Images from tonybianco.com.au
- [x] Investigate tonybianco.com.au URL structure (Shopify products.json API with StyleCode~ tags)
- [x] Add websiteImageUrl field to styleMeta table in drizzle/schema.ts
- [x] Run pnpm db:push to migrate schema
- [x] Add upsertStyleWebsiteImage / getAllStyleWebsiteImages DB helpers in server/db.ts
- [x] Build tRPC procedure style.fetchImages — paginates Shopify products.json, matches StyleCode~ tags, saves first image per style to DB
- [x] Build tRPC procedure style.getImages — returns all stored websiteImageUrls from styleMeta
- [x] Add "Fetch Style Images from Tony Bianco AU" button to ExportPanel
- [x] Display image thumbnail in By Style expanded row (80x80, links to TB search page)
- [x] Handle missing images gracefully (hidden when no URL found, onError hides broken images)
- [x] TypeScript: 0 errors confirmed

## Phase 57: Style Image Fetch — Selective Export
- [x] Add style multi-select UI to the Fetch Style Images card in ExportPanel
- [x] "All Styles" default mode; toggle to "Select Styles" mode shows a searchable checkbox list
- [x] Fetch button runs only on the selected subset (or all if in default mode)
- [x] TypeScript: 0 errors confirmed

## Phase 58: Style Image Fetch — SKU-level selector (SUPERSEDED)
- [x] Superseded — user clarified this was about Excel export, not image fetch. Handled via PDF extraction in Phase 58b.
- [x] Change selector from styles to SKUs (style + colour + leather combos)
- [x] "All SKUs" default; "Select SKUs" mode shows searchable grouped list (grouped by style)
- [x] Fetch runs on unique style names derived from selected SKUs
- [x] TypeScript: 0 errors confirmed

## Phase 59: Bulk Spec Sheet Upload
- [x] Add "Bulk Import" button to SpecsTab header (alongside existing single Import button)
- [x] Multi-file input (multiple XLS/XLSX at once)
- [x] Parse each file, auto-match to style by style name
- [x] Show per-file status: matched style, colour count, success/error
- [x] Save all matched specs in one go with progress indicator
- [x] Unmatched files shown with warning (style not found in list)

## Phase 60: Bulk Spec — Folder Drag & Drop
- [x] Add drag-and-drop zone to Bulk Import that accepts folders
- [x] Recursively traverse dropped folder entries to collect all .xls/.xlsx files
- [x] Also keep existing "select files" button as fallback
- [x] Show drop zone visually (dashed border, hover state)

## Phase 61: Specs — New Colours Only
- [x] Filter spec grid columns to only show colours from new SKUs (isNew=true)
- [x] Carry-over colours (isNew=false) must not appear as spec columns
- [x] buildStyleList colours array must only include new colours
- [x] Verify EDGY and other mixed styles show only new colours

## Phase 62: By Style — Category Filter Bug
- [x] Fix category filter showing 0 styles when a category is selected (CATEGORIES list had wrong values vs actual data)

## Phase 63: Full Sense Check Bug Fixes
- [x] Fix category filter: build availableCategories dynamically from stylesWithCategories (UPPERCASE match)
- [x] Fix filtered useMemo stale deps: now uses stylesWithCategories in deps array
- [x] Verified groupedByLast has no malformed code
- [x] Fix sample count: was counting carry-over SKUs as waiting; now only counts new SKUs
- [x] TypeScript: 0 real errors confirmed

## Phase 65: Fitting Groups (Style-Level Fitting Sessions)
- [x] Add fittingGroups table (id, name, date, notes) to drizzle/schema.ts
- [x] Add fittingGroupStyles join table (groupId, style) to drizzle/schema.ts
- [x] Run pnpm db:push to migrate schema
- [x] Add DB helpers: createFittingGroup, getAllFittingGroups, updateFittingGroup, deleteFittingGroup, addStyleToFittingGroup, removeStyleFromFittingGroup
- [x] Add tRPC procedures: fittingGroup.getAll, create, update, delete, addStyle, removeStyle
- [x] Add FittingGroupManager component in FittingTab — collapsible section with create/manage groups
- [x] Style picker: searchable list, add/remove styles per group with X badges
- [x] Edit group name and date inline
- [x] Export per group: Excel with one sheet per style (fit rating, notes, sessions)
- [x] TypeScript: 0 real errors confirmed

## Phase 66: Fitting Groups — Expandable Style Rows + Export Template
- [x] Fitting groups now show expandable style rows with fit rating, notes, and session list inline
- [x] Export rewritten to match FITTINGSSPREADSHEET template (one sheet per fit model)

## Phase 67: Fitting Group Session Delete Button
- [x] Add × delete button to each session card in the Fitting Group expanded style view
- [x] Confirmation dialog before deleting ("Delete the [model] session from [date]?")
- [x] After deletion, session list refreshes automatically via cache invalidation
- [x] deleteSessionMutation added to FittingGroupManager component scope

## Phase 68: Fitting — Drag-and-Drop Images + Lightbox Fix
- [x] Add drag-and-drop zone to fitting session image upload area (in addition to click-to-browse)
- [x] Fix full-screen image lightbox to close when clicking outside the image (backdrop click via portal)
- [x] Lightbox also closes on Escape key
- [x] Multiple images can be selected at once via click-to-browse

## Phase 69: Fitting Group — Inline Session Images
- [x] Show session images inline in the Fitting Group expanded style row (below notes, as thumbnails)
- [x] Clicking a thumbnail opens the lightbox for full-screen view (with click-outside and Escape to close)
