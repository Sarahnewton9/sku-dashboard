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
