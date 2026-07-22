import type { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js';
import attendance from '@/commands/attendance.js';
import lectureBoard from '@/commands/lecture-board.js';
import roleBoard from '@/commands/role-board.js';
import rosterSync from '@/commands/roster-sync.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
}

// 새 명령어를 추가하면 이 배열에만 넣어주세요.
export const commands: Command[] = [attendance, lectureBoard, rosterSync, roleBoard];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
