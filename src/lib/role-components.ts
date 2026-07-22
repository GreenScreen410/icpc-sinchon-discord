import { ButtonBuilder, type ButtonInteraction, ButtonStyle, ContainerBuilder, MessageFlags } from 'discord.js';
import { lookupDivision } from '@/lib/forms.js';

export const ROLE_ASSIGN_ID = 'role-assign';

// /역할버튼: 역할 부여 버튼이 담긴 메시지를 만듭니다.
export function buildRoleBoard() {
  const button = new ButtonBuilder()
    .setCustomId(ROLE_ASSIGN_ID)
    .setLabel('역할 부여받기')
    .setStyle(ButtonStyle.Success);

  return new ContainerBuilder()
    .setAccentColor(0x2fa653)
    .addTextDisplayComponents(
      (text) => text.setContent('## 역할 자동 부여'),
      (text) =>
        text.setContent(
          '닉네임을 아래 형식(`이름(아이디) 소속`)으로 설정한 뒤 버튼을 누르면, 신청한 분반(초급/중급) 역할을 자동으로 부여합니다.'
        ),
      (text) => text.setContent(['**예시**', '- 신촌 연합: `OOO(id) 홍익대`', '- 외부인: `OOO(id) 외부인`'].join('\n'))
    )
    .addSeparatorComponents((sep) => sep.setDivider(true))
    .addActionRowComponents((row) => row.addComponents(button));
}

// 닉네임 `이름(id) 소속`에서 실명·id·소속을 뽑습니다. (형식 안 맞으면 null)
function parseNickname(displayName: string): { name: string; id: string; affiliation: string } | null {
  const match = displayName.match(/^(.+?)\s*\((.+?)\)\s*(.+)$/);
  if (!match) return null;
  return { name: match[1].trim(), id: match[2].trim(), affiliation: match[3].trim() };
}

// 역할 부여 버튼: 닉네임 → 폼 조회 → 초급/중급 역할 부여
export async function handleRoleButton(interaction: ButtonInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: '❌ 서버 안에서만 사용할 수 있습니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const parsed = parseNickname(interaction.member.displayName);
  if (!parsed) {
    await interaction.editReply(
      '❌ 닉네임 형식이 올바르지 않습니다. `이름(id) 소속` 형식으로 설정한 뒤 다시 눌러주세요.'
    );
    return;
  }

  const result = await lookupDivision(parsed.name, parsed.id, parsed.affiliation);
  if (!result.ok) {
    const message =
      result.reason === 'notfound'
        ? '❌ 신청 내역을 찾지 못했습니다. 이름이 신청 폼과 같은지 확인하거나 운영진에게 문의해주세요.'
        : '❌ 동명이인이 있어 자동 판별이 어렵습니다. 운영진에게 문의해주세요.';
    await interaction.editReply(message);
    return;
  }

  const roleId = result.division === 'novice' ? process.env.NOVICE_ROLE_ID : process.env.ADVANCED_ROLE_ID;
  const label = result.division === 'novice' ? '초급' : '중급';
  if (!roleId) {
    await interaction.editReply('❌ 역할 ID가 설정되지 않았습니다. 운영진에게 문의해주세요.');
    return;
  }

  try {
    await interaction.member.roles.add(roleId);
    await interaction.editReply(`✅ **${label}** 역할을 부여했습니다!`);
  } catch (error) {
    console.log(error);
    await interaction.editReply(
      '❌ 역할 부여에 실패했습니다. 봇에 "역할 관리" 권한이 있고 봇 역할이 대상 역할보다 위에 있는지 확인해주세요.'
    );
  }
}
