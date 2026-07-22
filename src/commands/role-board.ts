import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { buildRoleBoard } from '@/lib/role-components.js';

export default {
  data: new SlashCommandBuilder()
    .setName('역할버튼')
    .setDescription('분반 역할 자동 부여 버튼을 채널에 게시합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    return interaction.reply({ components: [buildRoleBoard()], flags: MessageFlags.IsComponentsV2 });
  }
};
