import { mkdirSync, writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

export function generateFixSheet(rows: any[], outBase: string) {
  mkdirSync('out', { recursive: true });
  const data = rows.map((r) => ({
    경로: `${r.path} (${r.url})`,
    우선순위: r.severity,
    문제상세내용: `status=${r.status}\nexpected=${r.expected}\nactual=${r.actual}\nartifact=${r.screenshotPath ?? ''}`,
    진행사항: '수정 필요',
    테스터: 'AUTO',
    '수정 요청일': new Date(r.executedAt).toISOString().slice(0, 10),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'fix_requests');
  XLSX.writeFile(wb, `${outBase}.xlsx`);

  const csv = XLSX.utils.sheet_to_csv(ws);
  writeFileSync(`${outBase}.csv`, csv, 'utf-8');
}
