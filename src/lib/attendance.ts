import { type Client, ContainerBuilder, MessageFlags, type TextChannel } from 'discord.js';
import type { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import cron, { type ScheduledTask } from 'node-cron';
import { getDoc } from '@/lib/sheets.js';
import { logger } from '@/logger.js';

type Target = 'novice' | 'advanced';
type Results = { present: string[]; absent: string[] };

let attendanceEnabled = true;
let scheduledTasks: ScheduledTask[] = [];

const toText = (value: unknown) => value?.toString().trim() ?? '';

const getConfig = (target: Target) => ({
  vcId: target === 'novice' ? process.env.NOVICE_VOICE_CHANNEL_ID : process.env.ADVANCED_VOICE_CHANNEL_ID,
  reportId: target === 'novice' ? process.env.NOVICE_CHANNEL_ID : process.env.ADVANCED_CHANNEL_ID,
  label: target === 'novice' ? '초급' : '중급'
});

// 음성 채널에 접속 중인 멤버의 유저ID 집합을 가져옵니다.
async function fetchVoiceMemberIds(client: Client, guildId: string, vcId: string): Promise<Set<string>> {
  const guild = await client.guilds.fetch(guildId);
  const channel = await guild.channels.fetch(vcId).catch(() => null);
  if (!channel?.isVoiceBased()) throw new Error('음성 채널 오류');

  await guild.members.fetch();
  return new Set(channel.members.keys());
}

// 헤더 이름으로 열 위치를 찾습니다. (구조가 바뀌어도 견고)
function findColByHeader(sheet: GoogleSpreadsheetWorksheet, header: string): number {
  for (let c = 0; c < sheet.columnCount; c++) if (toText(sheet.getCell(0, c).value) === header) return c;
  return -1;
}

// 출결 시트의 날짜 열은 구글 시트 시리얼(예: 46226 = 2026.7.23)입니다. 오늘 날짜에 해당하는 열을 찾습니다.
function findTodayColumn(sheet: GoogleSpreadsheetWorksheet): number {
  const kst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD
  const [y, m, d] = kst.split('-').map(Number);
  const todaySerial = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);

  for (let c = 0; c < sheet.columnCount; c++) {
    const value = sheet.getCell(0, c).value;
    if (typeof value === 'number' && Math.round(value) === todaySerial) return c;
  }
  return -1;
}

// 출결에서 필요한 열 위치를 찾습니다. (누락/수업일 아님이면 null)
function locateColumns(sheet: GoogleSpreadsheetWorksheet) {
  const idCol = findColByHeader(sheet, '유저ID');
  const nameCol = findColByHeader(sheet, '이름');
  const diffCol = findColByHeader(sheet, '수강난이도');
  if (idCol < 0 || nameCol < 0 || diffCol < 0) {
    logger.error('출결 시트에 유저ID/이름/수강난이도 열이 없습니다.');
    return null;
  }
  const dateCol = findTodayColumn(sheet);
  if (dateCol < 0) {
    logger.error('출결 시트에 오늘 날짜 열이 없습니다. (수업일이 아니거나 날짜 열 누락)');
    return null;
  }
  return { idCol, nameCol, diffCol, dateCol };
}

type Columns = NonNullable<ReturnType<typeof locateColumns>>;

// 한 행이 대상 분반이면 오늘 날짜 열에 출석/결석을 기록하고 결과를 반환합니다. (대상 아님/빈 행이면 null)
function markRow(
  sheet: GoogleSpreadsheetWorksheet,
  cols: Columns,
  r: number,
  presentIds: Set<string>,
  label: string
): { present: boolean; name: string } | null {
  const id = toText(sheet.getCell(r, cols.idCol).value);
  if (!id) return null;
  if (!toText(sheet.getCell(r, cols.diffCol).value).includes(label)) return null;

  const present = presentIds.has(id);
  sheet.getCell(r, cols.dateCol).value = present ? 1 : 0;
  return { present, name: toText(sheet.getCell(r, cols.nameCol).value) || id };
}

// 출결 명단(해당 분반 행)을 훑어 오늘 날짜 열에 출석(1)/결석(0)을 기록합니다. 판정은 유저ID 기준.
function recordAttendance(sheet: GoogleSpreadsheetWorksheet, presentIds: Set<string>, label: string): Results | null {
  const cols = locateColumns(sheet);
  if (!cols) return null;

  const results: Results = { present: [], absent: [] };
  for (let r = 1; r < sheet.rowCount; r++) {
    const marked = markRow(sheet, cols, r, presentIds, label);
    if (marked) results[marked.present ? 'present' : 'absent'].push(marked.name);
  }
  return results;
}

// 출석 현황을 보고용 텍스트 채널에 임베드로 전송합니다.
async function sendReport(client: Client, reportId: string | undefined, label: string, results: Results) {
  const reportChannel = reportId ? await client.channels.fetch(reportId).catch(() => null) : null;
  if (!reportChannel?.isTextBased()) return;

  const embed = new ContainerBuilder().setAccentColor(0x2fa653).addTextDisplayComponents(
    (t) => t.setContent(`**[${label}] 출석 현황**`),
    (t) => t.setContent(`✅ **출석 (${results.present.length}명):** ${results.present.join(', ') || '없음'}`),
    (t) => t.setContent(`❌ **결석 (${results.absent.length}명):** ${results.absent.join(', ') || '없음'}`)
  );
  await (reportChannel as TextChannel).send({ components: [embed], flags: MessageFlags.IsComponentsV2 });
}

export async function runAttendanceCheck(client: Client, target: Target) {
  const { SPREADSHEET_ID, GUILD_ID } = process.env;
  const { vcId, reportId, label } = getConfig(target);

  if (!SPREADSHEET_ID || !GUILD_ID || !vcId) {
    logger.error('환경 변수 설정 누락');
    return;
  }

  const presentIds = await fetchVoiceMemberIds(client, GUILD_ID, vcId);

  const doc = await getDoc(SPREADSHEET_ID);
  const sheet = doc.sheetsByIndex[0]; // '출결' 탭
  await sheet.loadCells();

  const results = recordAttendance(sheet, presentIds, label);
  if (!results) return;

  await sheet.saveUpdatedCells();
  await sendReport(client, reportId, label, results);

  return results;
}

export function scheduleAttendanceCheck(client: Client) {
  if (scheduledTasks.length > 0) return;

  const schedule = (expr: string, target: Target) => {
    const task = cron.schedule(
      expr,
      () => {
        runAttendanceCheck(client, target).catch((error) => logger.error(error));
      },
      { timezone: 'Asia/Seoul' } // 서버 TZ와 무관하게 KST 기준 (findTodayColumn도 KST)
    );
    if (!attendanceEnabled) task.stop();
    return task;
  };

  // 초급 15:15, 중급 17:15 (매일)
  scheduledTasks = [schedule('15 15 * * *', 'novice'), schedule('15 17 * * *', 'advanced')];
}

export function isAttendanceEnabled() {
  return attendanceEnabled;
}

export function setAttendanceEnabled(enabled: boolean) {
  if (attendanceEnabled === enabled) return false;

  attendanceEnabled = enabled;
  for (const task of scheduledTasks) {
    if (enabled) task.start();
    else task.stop();
  }

  return true;
}
