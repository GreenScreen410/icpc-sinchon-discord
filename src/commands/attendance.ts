import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { isAttendanceEnabled, setAttendanceEnabled } from '@/lib/attendance.js';

export default {
  data: new SlashCommandBuilder()
    .setName('출석')
    .setDescription('자동 출석 체크 시스템을 활성화/비활성화 합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    const wasEnabled = isAttendanceEnabled();
    setAttendanceEnabled(!wasEnabled);

    await interaction.reply({
      content: wasEnabled ? '🛑 자동 출석 체크를 비활성화했습니다.' : '✅ 자동 출석 체크를 활성화했습니다.',
      flags: MessageFlags.Ephemeral
    });
  }
};
