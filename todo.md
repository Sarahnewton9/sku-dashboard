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
