import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { DIVISION_LABEL, type Division, upsertLectureLink } from '@/lib/lecture-links.js';

export default {
  data: new SlashCommandBuilder()
    .setName('강의링크')
    .setDescription('분반별/주차별 강의 링크를 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option.setName('분반').setDescription('강의 분반').setRequired(true).addChoices({ name: '초급', value: 'novice' }, { name: '중급', value: 'advanced' })
    )
    .addIntegerOption((option) => option.setName('주차').setDescription('강의 주차 번호').setRequired(true).setMinValue(1).setMaxValue(10))
    .addStringOption((option) => option.setName('링크').setDescription('강의 영상 링크').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    const division = interaction.options.getString('분반', true) as Division;
    const week = interaction.options.getInteger('주차', true);
    const link = interaction.options.getString('링크', true).trim();

    try {
      const url = new URL(link);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return interaction.reply({ content: '❌ 링크는 http/https 형식이어야 합니다.', flags: MessageFlags.Ephemeral });
      }
    } catch {
      return interaction.reply({ content: '❌ 올바른 URL 형식이 아닙니다.', flags: MessageFlags.Ephemeral });
    }

    await upsertLectureLink(division, week, link);

    return interaction.reply({ content: `✅ [${DIVISION_LABEL[division]}] ${week}주차 강의 링크를 저장했습니다.`, flags: MessageFlags.Ephemeral });
  }
};
