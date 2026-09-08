function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function csvSection(title: string, headers: string[], rows: string[][]): string[] {
  const lines = [title, headers.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvCell(cell)).join(","));
  }
  lines.push("");
  return lines;
}

export function buildCsvContent(sections: string[][]): string {
  const body = sections.flat().join("\n");
  return `\uFEFF${body}`;
}

export function csvDownloadResponse(
  filename: string,
  sections: string[][],
): { body: string; headers: Record<string, string> } {
  return {
    body: buildCsvContent(sections),
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  };
}
