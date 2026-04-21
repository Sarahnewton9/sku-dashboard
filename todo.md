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
