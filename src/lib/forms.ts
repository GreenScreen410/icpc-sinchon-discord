import type { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import type { Division } from '@/lib/lecture-links.js';
import { getDoc } from '@/lib/sheets.js';

// ⚠️ 시즌별 규격 의존: 이번 시즌 지원 폼의 열('이름'/'소속 학교'/'solved.ac'/'수강 선택')에 맞춰져 있습니다.
// 다음 시즌 폼이 바뀌면 아래 열 탐지/분반 라벨을 그 폼에 맞게 수정하세요.
const toText = (value: unknown) => (value == null ? '' : String(value).trim());
const normalize = (value: string) => value.replace(/\s+/g, '');

function toDivision(raw: string): Division | null {
  if (raw.includes('초급')) return 'novice';
  if (raw.includes('중급')) return 'advanced';
  return null;
}

interface Applicant {
  name: string;
  affiliation: string; // 내부인=소속학교, 외부인='외부인'
  id: string; // solved.ac 핸들 (선택입력 → 비어있을 수 있음)
  division: Division;
}

// 폼에 중복 헤더가 있어 getRows 대신 셀 인덱스로 헤더를 탐지합니다.
type FormCols = { nameCol: number; idCol: number; divCol: number; schoolCol: number };
function findFormColumns(sheet: GoogleSpreadsheetWorksheet): FormCols {
  const cols: FormCols = { nameCol: -1, idCol: -1, divCol: -1, schoolCol: -1 };
  for (let c = 0; c < sheet.columnCount; c++) {
    const h = toText(sheet.getCell(0, c).value).toLowerCase();
    if (h === '이름') cols.nameCol = c;
    else if (h.includes('solved')) cols.idCol = c;
    else if (h.includes('수강')) cols.divCol = c;
    else if (h.includes('소속')) cols.schoolCol = c;
  }
  return cols;
}

// 한 응답 행을 지원자로 파싱합니다. (이름/분반 없으면 null)
function parseApplicant(
  sheet: GoogleSpreadsheetWorksheet,
  cols: FormCols,
  r: number,
  external: boolean
): Applicant | null {
  const name = toText(sheet.getCell(r, cols.nameCol).value);
  if (!name) return null;
  const division = toDivision(toText(sheet.getCell(r, cols.divCol).value));
  if (!division) return null;

  let affiliation = '외부인';
  if (!external) affiliation = cols.schoolCol >= 0 ? toText(sheet.getCell(r, cols.schoolCol).value) : '내부인';
  const id = cols.idCol >= 0 ? toText(sheet.getCell(r, cols.idCol).value) : '';
  return { name, affiliation, id, division };
}

// 폼 응답을 읽습니다. external이면 소속을 '외부인'으로, 아니면 '소속 학교' 열 값으로 채웁니다.
async function readForm(spreadsheetId: string, external: boolean): Promise<Applicant[]> {
  const doc = await getDoc(spreadsheetId);
  const sheet = doc.sheetsByTitle['설문지 응답 시트1'] ?? doc.sheetsByIndex[0];

  const maxRow = Math.min(sheet.rowCount, 500);
  await sheet.loadCells({
    startRowIndex: 0,
    endRowIndex: maxRow,
    startColumnIndex: 0,
    endColumnIndex: sheet.columnCount
  });

  const cols = findFormColumns(sheet);
  if (cols.nameCol < 0 || cols.divCol < 0)
    throw new Error(`폼 시트에서 이름/분반 열을 찾지 못했습니다. (${spreadsheetId})`);

  const applicants: Applicant[] = [];
  for (let r = 1; r < maxRow; r++) {
    const applicant = parseApplicant(sheet, cols, r, external);
    if (applicant) applicants.push(applicant);
  }
  return applicants;
}

async function readApplicants(): Promise<Applicant[]> {
  const { FORM_INTERNAL_ID, FORM_EXTERNAL_ID } = process.env;
  if (!FORM_INTERNAL_ID && !FORM_EXTERNAL_ID)
    throw new Error('FORM_INTERNAL_ID / FORM_EXTERNAL_ID 환경 변수가 설정되지 않았습니다.');

  const all: Applicant[] = [];
  if (FORM_INTERNAL_ID) all.push(...(await readForm(FORM_INTERNAL_ID, false)));
  if (FORM_EXTERNAL_ID) all.push(...(await readForm(FORM_EXTERNAL_ID, true)));
  return all;
}

// 닉네임 소속과 폼 소속이 같은지 (외부인은 '외부' 포함 여부, 학교는 느슨한 포함 매칭)
function affiliationMatches(formAffiliation: string, nickAffiliation: string): boolean {
  const form = normalize(formAffiliation);
  const nick = normalize(nickAffiliation);
  if (form === '외부인') return nick.includes('외부');
  if (nick.includes('외부')) return false;
  return form.includes(nick) || nick.includes(form);
}

export type LookupResult = { ok: true; division: Division } | { ok: false; reason: 'notfound' | 'ambiguous' };

// 닉네임의 실명 + 소속(학교/외부인)으로 신청 분반을 찾습니다. 동명이인은 소속으로, 그래도 안 되면 id로 구분.
export async function lookupDivision(name: string, id: string, affiliation: string): Promise<LookupResult> {
  const applicants = await readApplicants();

  const byName = applicants.filter((a) => normalize(a.name) === normalize(name));
  if (byName.length === 0) return { ok: false, reason: 'notfound' };
  if (byName.length === 1) return { ok: true, division: byName[0].division };

  // 동명이인 → 소속(학교/외부인)으로 구분
  const bySchool = byName.filter((a) => affiliationMatches(a.affiliation, affiliation));
  if (bySchool.length === 1) return { ok: true, division: bySchool[0].division };

  // 그래도 안 되면 id(solved.ac)로 최후 구분 (입력했을 때만)
  const pool = bySchool.length > 0 ? bySchool : byName;
  const byId = id ? pool.filter((a) => a.id && normalize(a.id) === normalize(id)) : [];
  if (byId.length === 1) return { ok: true, division: byId[0].division };

  return { ok: false, reason: 'ambiguous' };
}
