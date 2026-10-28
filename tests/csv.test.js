const test = require("node:test");
const assert = require("node:assert/strict");
const { esc, toCsv, incomeCsv, expenseCsv } = require("../lib/csv");

test("esc quotes commas, quotes, and newlines", () => {
  assert.equal(esc("plain"), "plain");
  assert.equal(esc("a,b"), '"a,b"');
  assert.equal(esc('He said "hi"'), '"He said ""hi"""');
  assert.equal(esc("line1\nline2"), '"line1\nline2"');
  assert.equal(esc(null), "");
});

test("toCsv joins rows with CRLF", () => {
  assert.equal(toCsv([["a", "b"], ["c", 'd"e']]), 'a,b\r\nc,"d""e"');
});

test("incomeCsv writes a header and major-unit amounts", () => {
  const csv = incomeCsv([
    {
      name: "Salary",
      category: "salary",
      status: "received",
      frequency: "monthly",
      expectedDate: "2026-10-05",
      amountMinor: 8500000,
      receivedMinor: 8500000,
      receivedDate: "2026-10-05",
      notes: "",
    },
  ]);
  const lines = csv.split("\r\n");
  assert.match(lines[0], /^Name,Category,Status,Frequency,Expected date,Amount \(PKR\)/);
  assert.match(lines[1], /^Salary,salary,received,monthly,2026-10-05,85000\.00,85000\.00,2026-10-05,$/);
});

test("expenseCsv marks essentials and escapes notes", () => {
  const csv = expenseCsv([
    {
      name: 'Rent, "main"',
      category: "rent_housing",
      status: "unpaid",
      frequency: "monthly",
      dueDate: "2026-10-03",
      amountMinor: 3000000,
      paidMinor: 0,
      paidDate: null,
      essential: true,
      priority: 1,
      notes: "line1\nline2",
    },
  ]);
  const lines = csv.split("\r\n");
  assert.match(lines[1], /^"Rent, ""main""",rent_housing,unpaid,monthly,2026-10-03,30000\.00,0\.00,,yes,1,"line1/);
});
