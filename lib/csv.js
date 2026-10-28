function esc(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(esc).join(",")).join("\r\n");
}

function major(minor) {
  return ((Number(minor) || 0) / 100).toFixed(2);
}

function incomeCsv(items) {
  const rows = [["Name", "Category", "Status", "Frequency", "Expected date", "Amount (PKR)", "Received (PKR)", "Received date", "Notes"]];
  for (const item of items) {
    rows.push([
      item.name,
      item.category,
      item.status,
      item.frequency,
      item.expectedDate,
      major(item.amountMinor),
      major(item.receivedMinor),
      item.receivedDate || "",
      item.notes || "",
    ]);
  }
  return toCsv(rows);
}

function expenseCsv(items) {
  const rows = [["Name", "Category", "Status", "Frequency", "Due date", "Amount (PKR)", "Paid (PKR)", "Paid date", "Essential", "Priority", "Notes"]];
  for (const item of items) {
    rows.push([
      item.name,
      item.category,
      item.status,
      item.frequency,
      item.dueDate,
      major(item.amountMinor),
      major(item.paidMinor),
      item.paidDate || "",
      item.essential ? "yes" : "no",
      item.priority,
      item.notes || "",
    ]);
  }
  return toCsv(rows);
}

module.exports = { esc, toCsv, incomeCsv, expenseCsv };
