import { Listener } from "@sapphire/framework";
import type { Client } from "discord.js";
import { scheduleAttendanceCheck } from "../lib/attendance.js";

export class ReadyListener extends Listener {
	public run(client: Client<true>) {
		const { username, id } = client.user;
		this.container.logger.info(`Successfully logged in as ${username} (${id})`);
		scheduleAttendanceCheck();
	}
}
