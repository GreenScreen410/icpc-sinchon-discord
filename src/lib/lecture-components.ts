import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ContainerBuilder,
  type GuildMember,
  MessageFlags,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { DIVISION_LABEL, type Division, getLectureLink } from '@/lib/lecture-links.js';
import { getPass } from '@/lib/roster.js';
import { logger } from '@/logger.js';

export const LECTURE_SELECT_ID = 'lecture-select';
export const LECTURE_CONFIRM_PREFIX = 'confirm-lecture:';

const LECTURE_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  label: `${i + 1}주차 강의`,
  value: `week-${i + 1}`,
  emoji: '📚'
}));

// /버튼생성: 주차 선택 드롭다운이 담긴 메시지를 만듭니다.
export function buildLectureBoard() {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(LECTURE_SELECT_ID)
    .setPlaceholder('📚 수강할 주차를 선택하세요')
    .addOptions(LECTURE_OPTIONS.map((opt) => new StringSelectMenuOptionBuilder().setLabel(opt.label).setValue(opt.value).setEmoji(opt.emoji)));

  return new ContainerBuilder()
    .setAccentColor(0x2fa653)
    .addTextDisplayComponents(
      (text) => text.setContent('## 📖 강의 영상'),
      (text) => text.setContent('아래 드롭다운에서 주차를 선택하면 본인 분반(초급/중급)의 강의 영상 링크를 DM으로 보내드립니다.')
    )
    .addSeparatorComponents((sep) => sep.setDivider(true))
    .addActionRowComponents((row) => row.addComponents(selectMenu));
}

// 드롭다운에서 주차를 고르면 확인/취소 버튼을 띄웁니다.
export async function handleLectureSelect(interaction: StringSelectMenuInteraction) {
  const selected = interaction.values[0];
  const weekNumber = selected.replace('week-', '');

  const confirmButton = new ButtonBuilder()
    .setCustomId(`${LECTURE_CONFIRM_PREFIX}${selected}`)
    .setLabel(`${weekNumber}주차 강의 받기`)
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder().setCustomId(`${LECTURE_CONFIRM_PREFIX}cancel`).setLabel('취소').setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

  await interaction.reply({
    content: `📚 **${weekNumber}주차 강의**를 선택하셨습니다. 맞으시면 확인 버튼을 눌러주세요!`,
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

// 멤버의 역할(초급/중급)로 분반을 판별합니다.
function getMemberDivision(member: GuildMember): Division | null {
  const { NOVICE_ROLE_ID, ADVANCED_ROLE_ID } = process.env;
  const roles = member.roles.cache;
  if (NOVICE_ROLE_ID && roles.has(NOVICE_ROLE_ID)) return 'novice';
  if (ADVANCED_ROLE_ID && roles.has(ADVANCED_ROLE_ID)) return 'advanced';
  return null;
}

// 수강권이 남아있으면 해당 주차 링크를 DM으로 보내고 수강권을 1 차감합니다. (deferUpdate 이후 호출)
async function provideLecture(interaction: ButtonInteraction<'cached'>, division: Division, week: number) {
  try {
    const link = await getLectureLink(division, week);
    if (!link) {
      await interaction.editReply({
        content: `❌ [${DIVISION_LABEL[division]}] ${week}주차 강의 링크가 아직 등록되지 않았습니다. 관리자에게 문의해주세요.`,
        components: []
      });
      return;
    }

    const { remaining, commit } = await getPass(interaction.user.id, interaction.member.displayName, division);
    if (remaining <= 0) {
      await interaction.editReply({ content: '🚫 남은 수강권이 없습니다. 운영진에게 문의해주세요.', components: [] });
      return;
    }

    await interaction.user.send(`📚 **[${DIVISION_LABEL[division]}] ${week}주차 강의 영상**\n${link}`);
    await commit(); // 수강권 1 차감

    await interaction.editReply({ content: `✅ ${week}주차 강의 링크를 DM으로 전송했습니다. 남은 수강권: ${remaining - 1}개`, components: [] });
  } catch (error) {
    logger.error(error);
    await interaction.editReply({ content: '❌ 강의 링크를 전송할 수 없습니다. DM 설정 또는 시트 설정을 확인해주세요.', components: [] });
  }
}

// 확인 버튼을 누르면 본인 분반의 해당 주차 강의 링크를 DM으로 보냅니다.
export async function handleLectureButton(interaction: ButtonInteraction) {
  const value = interaction.customId.replace(LECTURE_CONFIRM_PREFIX, '');

  if (value === 'cancel') {
    await interaction.update({ content: '❌ 취소되었습니다. 다시 선택해주세요.', components: [] });
    return;
  }

  const week = Number(value.replace('week-', ''));
  if (Number.isNaN(week)) {
    await interaction.update({ content: '❌ 잘못된 주차 정보입니다. 다시 시도해주세요.', components: [] });
    return;
  }

  if (!interaction.inCachedGuild()) {
    await interaction.update({ content: '❌ 서버 안에서만 사용할 수 있습니다.', components: [] });
    return;
  }

  const division = getMemberDivision(interaction.member);
  if (!division) {
    await interaction.update({ content: '❌ 초급/중급 수강생 역할이 없어 링크를 보낼 수 없습니다. 운영진에게 문의해주세요.', components: [] });
    return;
  }

  // 시트 왕복이 있으니 먼저 응답을 확보(deferUpdate)한 뒤 처리합니다.
  await interaction.deferUpdate();
  await provideLecture(interaction, division, week);
}
