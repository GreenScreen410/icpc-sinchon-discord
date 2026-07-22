import {
  type ChatInputCommandInteraction,
  type Interaction,
  type InteractionReplyOptions,
  MessageFlags
} from 'discord.js';
import { commandMap } from '@/commands/index.js';
import {
  handleLectureButton,
  handleLectureSelect,
  LECTURE_CONFIRM_PREFIX,
  LECTURE_SELECT_ID
} from '@/lib/lecture-components.js';
import { handleRoleButton, ROLE_ASSIGN_ID } from '@/lib/role-components.js';

async function handleCommand(interaction: ChatInputCommandInteraction) {
  const command = commandMap.get(interaction.commandName);
  if (command == null) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.log(error);
    const payload: InteractionReplyOptions = {
      content: '❌ 명령어 실행 중 오류가 발생했습니다.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
}

// 모든 인터랙션(명령어 / 드롭다운 / 버튼)의 라우터
export async function handleInteraction(interaction: Interaction) {
  // 강의 선택 드롭다운
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === LECTURE_SELECT_ID) await handleLectureSelect(interaction);
    return;
  }

  // 버튼 (강의 확인/취소, 역할 부여)
  if (interaction.isButton()) {
    if (interaction.customId.startsWith(LECTURE_CONFIRM_PREFIX)) await handleLectureButton(interaction);
    else if (interaction.customId === ROLE_ASSIGN_ID) await handleRoleButton(interaction);
    return;
  }

  // 슬래시 명령어
  if (interaction.isChatInputCommand()) await handleCommand(interaction);
}
