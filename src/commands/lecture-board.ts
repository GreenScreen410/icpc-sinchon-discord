import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { buildLectureBoard } from '@/lib/lecture-components.js';

export default {
  data: new SlashCommandBuilder()
    .setName('버튼생성')
    .setDescription('강의 선택 드롭다운 메시지를 채널에 전송합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    return interaction.reply({ components: [buildLectureBoard()], flags: MessageFlags.IsComponentsV2 });
  }
};
