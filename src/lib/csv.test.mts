/**
 * Tests for the hand-rolled CSV parser.
 *
 *   npm run test:csv
 *
 * These are the cases that break naive `split(",")` parsers, and every one of
 * them appears in a real school spreadsheet: names containing commas, Excel's
 * UTF-8 BOM, and Windows line endings.
 */
import { parseCsv, parseCsvRecords } from "./csv.ts";

let fails = 0;
const eq = (got: unknown, want: unknown, label: string) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) {
    console.log(`FAIL  ${label}\n  got  ${a}\n  want ${b}`);
    fails++;
  } else {
    console.log(`pass  ${label}`);
  }
};

eq(parseCsv("a,b\n1,2"), [["a", "b"], ["1", "2"]], "basic");
eq(
  parseCsv('name,x\n"Achieng, Faith",1'),
  [["name", "x"], ["Achieng, Faith", "1"]],
  "comma inside quotes",
);
eq(parseCsv('a\n"She said ""hi"""'), [["a"], ['She said "hi"']], "escaped quotes");
eq(parseCsv("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]], "CRLF and trailing newline");
eq(
  parseCsv("﻿admission_no,name\n1,x"),
  [["admission_no", "name"], ["1", "x"]],
  "UTF-8 BOM stripped (Excel writes this)",
);
eq(parseCsv("a,b\n\n1,2"), [["a", "b"], ["1", "2"]], "blank line skipped");
eq(parseCsv('a,b\n"multi\nline",2'), [["a", "b"], ["multi\nline", "2"]], "newline inside quotes");
eq(parseCsv("a,b\n1,"), [["a", "b"], ["1", ""]], "trailing empty field");

const { headers, records } = parseCsvRecords("Admission No,First Name\nGS/1,Faith");
eq(headers, ["admission_no", "first_name"], "headers normalised");
eq(records, [{ admission_no: "GS/1", first_name: "Faith" }], "records keyed by header");

console.log(fails ? `\n${fails} FAILURES` : "\nall csv tests passed");
process.exit(fails ? 1 : 0);
