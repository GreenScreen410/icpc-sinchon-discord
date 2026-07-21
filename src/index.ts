import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import { commands } from '@/commands/index.js';
import { handleInteraction } from '@/interactions.js';
import { scheduleAttendanceCheck } from '@/lib/attendance.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Successfully logged in as ${readyClient.user.username} (${readyClient.user.id})`);
  scheduleAttendanceCheck(readyClient);
});

client.on(Events.InteractionCreate, handleInteraction);

await client.login(process.env.DISCORD_TOKEN);

// 슬래시 명령어를 길드에 등록 (즉시 반영)
const rest = new REST().setToken(process.env.DISCORD_TOKEN);
const app = (await rest.get(Routes.currentApplication())) as { id: string };
await rest.put(Routes.applicationGuildCommands(app.id, process.env.GUILD_ID), {
  body: commands.map((command) => command.data.toJSON())
});
// 글로벌 명령어는 비워 둡니다 (길드 등록과 중복 방지)
await rest.put(Routes.applicationCommands(app.id), { body: [] });
console.log(`Registered ${commands.length} commands to guild ${process.env.GUILD_ID}`);
