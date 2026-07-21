import { getDoc } from '@/lib/sheets.js';

export type Division = 'novice' | 'advanced';

export const DIVISION_LABEL: Record<Division, string> = { novice: '초급', advanced: '중급' };

// 강의 링크는 출석 시트가 아닌 '링크' 탭에서 (분반, 주차, 링크)로 관리합니다.
const SHEET_TITLE = '링크';
const HEADERS = ['분반', '주차', '링크'];

async function getLectureSheet() {
  const { SPREADSHEET_ID } = process.env;
  if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID 환경 변수가 설정되지 않았습니다.');

  const doc = await getDoc(SPREADSHEET_ID);
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (sheet) return sheet;

  // 탭이 없으면 헤더와 함께 새로 만듭니다.
  return doc.addSheet({ title: SHEET_TITLE, headerValues: HEADERS });
}

export async function getLectureLink(division: Division, week: number): Promise<string | null> {
  const sheet = await getLectureSheet();
  const rows = await sheet.getRows();
  const row = rows.find((r) => r.get('분반') === DIVISION_LABEL[division] && Number(r.get('주차')) === week);
  return row?.get('링크')?.trim() || null;
}

export async function upsertLectureLink(division: Division, week: number, link: string): Promise<void> {
  const sheet = await getLectureSheet();
  const rows = await sheet.getRows();
  const row = rows.find((r) => r.get('분반') === DIVISION_LABEL[division] && Number(r.get('주차')) === week);

  if (row) {
    row.set('링크', link);
    await row.save();
  } else {
    await sheet.addRow({ 분반: DIVISION_LABEL[division], 주차: week, 링크: link });
  }
}
