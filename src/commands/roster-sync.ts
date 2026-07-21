import { type ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { type RosterMember, syncRoster } from '@/lib/roster.js';

export default {
  data: new SlashCommandBuilder()
    .setName('명단동기화')
    .setDescription('초급/중급 역할 멤버를 출결 시트 명단에 동기화합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      return interaction.reply({ content: '❌ 서버 안에서만 사용할 수 있습니다.', flags: MessageFlags.Ephemeral });
    }

    const { NOVICE_ROLE_ID, ADVANCED_ROLE_ID } = process.env;
    if (!NOVICE_ROLE_ID || !ADVANCED_ROLE_ID) {
      return interaction.reply({
        content: '❌ 역할 ID 환경 변수(NOVICE_ROLE_ID/ADVANCED_ROLE_ID)가 설정되지 않았습니다.',
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.guild.members.fetch();

    const members: RosterMember[] = [];
    for (const m of interaction.guild.members.cache.values()) {
      if (m.roles.cache.has(NOVICE_ROLE_ID)) {
        members.push({ id: m.id, name: m.displayName, division: 'novice' });
      } else if (m.roles.cache.has(ADVANCED_ROLE_ID)) {
        members.push({ id: m.id, name: m.displayName, division: 'advanced' });
      }
    }

    const { added, updated } = await syncRoster(members);
    await interaction.editReply({
      content: `✅ 명단 동기화 완료: 대상 ${members.length}명 (추가 ${added}, 갱신 ${updated})`
    });
  }
};
