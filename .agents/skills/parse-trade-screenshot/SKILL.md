---
name: Parse Trade Table Screenshot
description: Triggers when the user uploads a screenshot of a trade statistics table (with columns like Pair, Start Date, End Date, Trade Type, Execution Type, Status, Entry Price, Stop Loss, Take Profit, Profit/Loss). Parses the image and imports the records into the SQLite database.
---

# Instruction for Parsing Trade Table Screenshot

When the user uploads or refers to an image showing a trade statistics table, follow this workflow:

## 1. Extract Tabular Data
Use Gemini's multimodal/vision capabilities to extract all rows and columns from the table in the image.
The columns typically present in the image are:
- `Pair`: e.g. "XAU/USD" or "GBP/USD"
- `Start Date`: e.g. "08/01/2025, 09:29 PM"
- `End Date`: e.g. "08/01/2025, 11:21 PM"
- `Trade Type`: "buy" or "sell"
- `Execution Type`: e.g. "Limit" or "Market"
- `Status`: e.g. "Closed"
- `Entry Price`: e.g. "3346.54"
- `Stop Loss`: e.g. "3341.05"
- `Take Profit`: e.g. "3353.3"
- `Profit/Loss`: e.g. "-$50.00"

## 2. Normalize Data for Database
Map the extracted columns to the SQLite `trades` table schema in `/Users/mac/Learning/ai-trading/trades.db`:
- **`asset`**: Clean the `Pair` (remove slashes, make uppercase, e.g. "XAU/USD" -> "XAUUSD").
- **`side`**: Convert `Trade Type` to uppercase "BUY" or "SELL".
- **`entry_price`**: Parse numeric value from `Entry Price` (e.g. `3346.54`).
- **`exit_price`**: Since exit price is not in the table, set it to `0.0`.
- **`stop_loss`**: Parse numeric value (or `null` if none/empty).
- **`take_profit`**: Parse numeric value (or `null` if none/empty).
- **`size`**: Since the table might not have a size, prompt the user for the default size or assume a default of `0.01` (and note it in the notes).
- **`pnl`**: Parse numeric value from `Profit/Loss` (remove currency symbols, preserve negative sign, e.g. "-$50.00" -> `-50.00`).
- **`status`**: Determine based on PnL: if PnL > 0 then "WIN", if PnL < 0 then "LOSS", if PnL == 0 then "BREAKEVEN".
- **`trade_time`**: Convert `Start Date` to format `YYYY-MM-DD HH:MM` (e.g. "08/01/2025, 09:29 PM" -> "2025-08-01 21:29").
- **`exit_time`**: Convert `End Date` to format `YYYY-MM-DD HH:MM` (e.g. "08/01/2025, 11:21 PM" -> "2025-08-01 23:21").
- **`trade_type`**: Hardcode to `'BACKTEST'`.
- **`setup_tag`**: Classify the trade setup into one of the standardized categories: `'Keylevel'`, `'Breakout'`, `'LHRetest'`, `'FBO'`, `'FOMO'`, `'Trend Following'`, or `'Discretionary'`. For example, support/resistance bounce setups should be mapped to `'Keylevel'`.
- **`user_notes`**: Concatenate additional details: e.g. "Execution: Limit | Status in UI: Closed | Imported from screenshot."

## 3. Generate and Execute Import Script
Create a temporary Node.js script in the scratch directory: `<appDataDir>/brain/<conversation-id>/scratch/import_screenshot_trades.js`.
The script should:
- Connect to `/Users/mac/Learning/ai-trading/trades.db` using the `sqlite3` driver.
- **Deduplication Check**: For each parsed trade, perform a query checking if a record with the same `asset`, `trade_time`, `exit_time`, `pnl`, and `side` already exists in the `trades` table.
- If a match is found, skip it (do not insert) to prevent duplicates.
- Otherwise, insert the new normalized trade record.
- Log the number of successfully imported trades and the number of skipped duplicate trades.

Run the script using `run_command` (after requesting user approval).

## 4. Confirm to User
Output a markdown table of the parsed trades and confirm they have been successfully imported into the backtest database.
