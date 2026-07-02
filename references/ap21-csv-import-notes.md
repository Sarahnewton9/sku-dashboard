# AP21 CSV Import Notes

Source: `/home/ubuntu/upload/106571–B2B–Productdataimportfrom.csvfile.pdf`

## Purpose
This Apparel21 B2B format allows product data to be imported from an external system via a CSV file and generated into Apparel21.

## Setup requirements noted in the spec
- Workgroup Security must be enabled for B2B Translate In, B2B Tasks, and EDI/B2B Trading Partners.
- A B2B document template must be loaded by an Apparel21 consultant.
- A B2B trading partner must be created for the import/export flow.
- Trading partner setup highlights:
  - Last inbound ICN set to `1`.
  - Incoming B2B template set to `CSV Product Imp`.
- Template default values mentioned:
  - Sell price scheme default is `Standard`.
  - Stocked unit of measure default is `Each`.

## File-level rules
- File naming convention: `products_xxxxxxxx.csv` where the suffix is any unique set of characters.
- The file name is checked for uniqueness so the same file is not imported twice in error.
- File must be CSV.
- A file can only be translated once; successfully imported files cannot be re-imported under the same name.

## Required field ordering in the CSV
The data in the file must be sent in this order:
1. Style Code
2. Colour Code
3. Dimension Code
4. Size Code

The spec states that if rows are not ordered in that sequence, validation/creation will fail.

## Field list captured from the spec pages reviewed
### Core fields
- Article Code — required — maps to product style code.
- Article Name — required — maps to product description.
- Comments — optional — product comments.
- Colour Code — optional.
- Colour Description — optional.
- Size Code — optional — described as size range code.
- Code1 — optional — size code within the size range.
- EAN Code — optional.
- Sell Price — optional numeric.
- Purchased — required Y/N.
- Produced — required Y/N.
- Sold — required Y/N.
- Stocked — required Y/N.
- UsedInProd — required Y/N.
- Include in MRP — required Y/N.
- Sold at Retail — required Y/N.

### Reference fields
- Ref1..Ref10 — style product reference codes.
- Ref11..Ref20 — component reference codes.
- Ref21..Ref30 — colour reference codes.

### Additional fields
- Cost — optional numeric purchasing cost. Note says costs do not apply to Produced-only items.
- Dimension Range — optional.
- Dimension Code — optional.
- Style Level — required numeric:
  - `0` = no colours, no sizes
  - `1` = colours but no sizes
  - `2` = colours and sizes
- UOM — optional unit of measurement; template default can apply to all stocked lines.

## Validation / error notes from the spec
Structural/file-level rejection can happen for:
- Incorrect fields
- Incorrect field lengths
- Incorrect file name
- Duplicate file name already successfully imported
- Trading partner cannot be established
- File format cannot be matched to an Apparel21 template

Record-level data errors mentioned include:
- Missing style code or style name
- Style level not sent
- Invalid size range for a sized style
- Invalid or no colour code for a coloured style
- Invalid or no size for a sized style
- Purchased and Produced not containing a `Y`
- Invalid combinations of sold / purchased / produced / include MRP / retail flags
- Mandatory reference codes not supplied where Apparel21 expects them on style/component objects
- Incorrect dimension range/code
- Dimension range/code supplied for a non-coloured style

## Operational notes
- Apparel21 can schedule B2B In Receive and B2B In Translate tasks to process incoming files from a configured folder.
- The spec assumes file-based handoff into an AP21-accessible folder rather than a direct API.

## Implication for SKU Dash integration
A practical first integration path is likely:
1. Build an AP21 export screen in SKU Dash.
2. Map SKU Dash style/colour/size data to the AP21 CSV columns.
3. Generate a correctly ordered CSV with a unique `products_*.csv` file name.
4. Let the user download it or place it into the agreed AP21 drop folder workflow.

Open question to confirm with user/AP21 consultant:
- Which of the many optional AP21 fields are actually required in the user's Apparel21 configuration/template beyond the generic spec.
- Whether SKU Dash should export style-only rows, colour rows, and size rows, or only one chosen style level.
- Whether AP21 import will be manual download/upload or automated to a watched folder.

## References
- Apparel21 PDF provided by user: `106571–B2B–Productdataimportfrom.csvfile.pdf`
