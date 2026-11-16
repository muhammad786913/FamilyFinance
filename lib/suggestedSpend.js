/**
 * Turns the engine's zero-suggestion reason into one short sentence for the UI.
 * The engine deliberately only suggests money that is already confirmed, so a
 * zero is usually a cash-position fact rather than a bug.
 */
export function suggestedSpendHint(row) {
  if (!row || Number(row.suggestedDiscretionaryMinor) > 0) return "";
  switch (row.suggestedBlocker) {
    case "no_cash":
      return "No confirmed cash yet. Mark income as received or add an opening cash balance.";
    case "reserve":
      return "Your emergency reserve uses all of today's confirmed cash.";
    case "essentials":
      return "Essential bills due before your next received income use all confirmed cash.";
    case "too_small":
      return "Only a tiny amount is spare, so it rounds down to Rs 0 per day.";
    default:
      return "There is no spare cash after the reserve and upcoming essential bills.";
  }
}
