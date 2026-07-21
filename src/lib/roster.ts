import type { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { DIVISION_LABEL, type Division } from '@/lib/lecture-links.js';
import { getDoc } from '@/lib/sheets.js';

// 학생 명단과 수강권은 '출결' 시트 한 곳에서 관리합니다. (유저ID | 이름 | 수강난이도 | 수강권 | 날짜들 | 합계)
// 쓰기는 loadCells + saveUpdatedCells로만 하여 합계 수식 등 손대지 않은 셀은 보존합니다.
const toText = (value: unknown) => value?.toString().trim() ?? '';

async function getSheet(): Promise<GoogleSpreadsheetWorksheet> {
  const { SPREADSHEET_ID } = process.env;
  if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID 환경 변수가 설정되지 않았습니다.');
  const doc = await getDoc(SPREADSHEET_ID);
  return doc.sheetsByTitle['출결'] ?? doc.sheetsByIndex[0];
}

function findCol(sheet: GoogleSpreadsheetWorksheet, header: string): number {
  for (let c = 0; c < sheet.columnCount; c++) if (toText(sheet.getCell(0, c).value) === header) return c;
  return -1;
}

interface Cols {
  idCol: number;
  nameCol: number;
  diffCol: number;
  passCol: number;
}

function locateCols(sheet: GoogleSpreadsheetWorksheet): Cols | null {
  const cols = { idCol: findCol(sheet, '유저ID'), nameCol: findCol(sheet, '이름'), diffCol: findCol(sheet, '수강난이도'), passCol: findCol(sheet, '수강권') };
  if (Object.values(cols).some((c) => c < 0)) {
    return null;
  }
  return cols;
}

// 기존 행을 유저ID로 색인하고, 새 행을 붙일 위치(nextRow)를 계산합니다.
function scanRows(sheet: GoogleSpreadsheetWorksheet, cols: Cols) {
  const byId = new Map<string, number>();
  let maxRow = 0;
  for (let r = 1; r < sheet.rowCount; r++) {
    const id = toText(sheet.getCell(r, cols.idCol).value);
    const nm = toText(sheet.getCell(r, cols.nameCol).value);
    if (id || nm) maxRow = r;
    if (id) byId.set(id, r);
  }
  return { byId, nextRow: maxRow + 1 };
}

export interface RosterMember {
  id: string;
  name: string;
  division: Division;
}

// /명단동기화: 역할 멤버를 출결 명단(유저ID/이름/수강난이도)에 upsert. 신규는 기본 수강권 부여, 수강권/날짜 기록은 보존.
export async function syncRoster(members: RosterMember[]): Promise<{ added: number; updated: number }> {
  const sheet = await getSheet();
  await sheet.loadCells();
  const cols = locateCols(sheet);
  if (!cols) throw new Error('출결 시트에 유저ID/이름/수강난이도/수강권 열이 있어야 합니다.');

  const { byId, nextRow } = scanRows(sheet, cols);
  let next = nextRow;
  let added = 0;
  let updated = 0;
  for (const m of members) {
    const label = DIVISION_LABEL[m.division];
    const existing = byId.get(m.id);
    if (existing === undefined) {
      if (next >= sheet.rowCount) break;
      sheet.getCell(next, cols.idCol).value = m.id;
      sheet.getCell(next, cols.nameCol).value = m.name;
      sheet.getCell(next, cols.diffCol).value = label;
      // 수강권은 비워둡니다 → 운영진이 시트에서 직접 지정
      next++;
      added++;
    } else if (toText(sheet.getCell(existing, cols.nameCol).value) !== m.name || toText(sheet.getCell(existing, cols.diffCol).value) !== label) {
      sheet.getCell(existing, cols.nameCol).value = m.name;
      sheet.getCell(existing, cols.diffCol).value = label;
      updated++;
    }
  }
  await sheet.saveUpdatedCells();
  return { added, updated };
}

export interface PassResult {
  remaining: number;
  commit: () => Promise<void>; // 강의 전송 성공 시 호출 → 수강권 1 차감
}

// 강의 요청 학생의 남은 수강권을 확인합니다. 명단에 없으면 수강권을 비워둔 채로 추가합니다. (운영진이 지정 전까지 0 → 거절)
export async function getPass(userId: string, name: string, division: Division): Promise<PassResult> {
  const sheet = await getSheet();
  await sheet.loadCells();
  const cols = locateCols(sheet);
  if (!cols) throw new Error('출결 시트에 유저ID/이름/수강난이도/수강권 열이 있어야 합니다.');

  const { byId, nextRow } = scanRows(sheet, cols);
  const existing = byId.get(userId);
  const row = existing ?? nextRow;
  if (existing === undefined) {
    // 명단에 없던 학생을 추가 (수강권은 비워둠 → 운영진이 시트에서 지정)
    sheet.getCell(row, cols.idCol).value = userId;
    sheet.getCell(row, cols.nameCol).value = name;
    sheet.getCell(row, cols.diffCol).value = DIVISION_LABEL[division];
    await sheet.saveUpdatedCells();
  }

  const remaining = Math.max(0, Math.trunc(Number(toText(sheet.getCell(row, cols.passCol).value)) || 0));
  const commit = async () => {
    sheet.getCell(row, cols.passCol).value = remaining - 1;
    await sheet.saveUpdatedCells();
  };
  return { remaining, commit };
}
