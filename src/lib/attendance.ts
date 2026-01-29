import { container } from "@sapphire/framework";
import { ContainerBuilder, MessageFlags, type TextChannel } from "discord.js";
import cron from "node-cron";
import { getDoc } from "./google-sheets.js";

const getConfig = (target: "novice" | "advanced") => ({
	vcId: target === "novice" ? process.env.NOVICE_VOICE_CHANNEL_ID : process.env.ADVANCED_VOICE_CHANNEL_ID,
	reportId: target === "novice" ? process.env.NOVICE_CHANNEL_ID : process.env.ADVANCED_CHANNEL_ID,
	label: target === "novice" ? "Novice (초급)" : "Advanced (중급)",
});

export async function runAttendanceCheck(target: "novice" | "advanced") {
	const { SPREADSHEET_ID, GUILD_ID } = process.env;
	const { vcId, reportId, label } = getConfig(target);

	if (!SPREADSHEET_ID || !GUILD_ID || !vcId) return container.logger.error("환경 변수 설정 누락");

	const guild = await container.client.guilds.fetch(GUILD_ID);
	const channel = await guild.channels.fetch(vcId).catch(() => null);
	if (!channel?.isVoiceBased()) throw new Error("음성 채널 오류");

	await guild.members.fetch();
	const members = Array.from(channel.members.values());

	const doc = await getDoc(SPREADSHEET_ID);
	const sheet = doc.sheetsByIndex[0];
	await sheet.loadCells();

	const today = new Date();
	const todayStr = `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
	const dateIdx = Array.from({ length: sheet.columnCount }).findIndex(
		(_, i) => sheet.getCell(0, i).value?.toString().trim() === todayStr,
	);

	const results = { present: [] as string[], absent: [] as string[] };
	for (let r = 1; r < sheet.rowCount; r++) {
		const [name, , diff, handle] = [0, 1, 2, 3].map((i) => sheet.getCell(r, i).value?.toString().trim());
		if (!name || !handle || !diff?.includes(label)) continue;

		const isPresent = members.some((m) =>
			[m.user.username, m.nickname, m.displayName]
				.filter(Boolean)
				.some((v) => v!.toLowerCase().includes(handle.toLowerCase())),
		);

		sheet.getCell(r, dateIdx).value = isPresent ? 1 : 0;
		results[isPresent ? "present" : "absent"].push(`${name}(${handle})`);
	}

	await sheet.saveUpdatedCells();
	const reportChannel = reportId ? await container.client.channels.fetch(reportId).catch(() => null) : null;
	if (reportChannel?.isTextBased()) {
		const embed = new ContainerBuilder().setAccentColor(0x00db65).addTextDisplayComponents(
			(t) => t.setContent(`**[${label}] 출석 현황**`),
			(t) => t.setContent(`✅ **출석 (${results.present.length}명):** ${results.present.join(", ") || "없음"}`),
			(t) => t.setContent(`❌ **결석 (${results.absent.length}명):** ${results.absent.join(", ") || "없음"}`),
		);
		await (reportChannel as TextChannel).send({ components: [embed], flags: MessageFlags.IsComponentsV2 });
	}

	return results;
}

export function scheduleAttendanceCheck() {
	const schedule = (t: string, target: "novice" | "advanced") => cron.schedule(t, () => runAttendanceCheck(target));
	schedule("10 15 * * *", "novice");
	schedule("10 17 * * *", "advanced");
}
