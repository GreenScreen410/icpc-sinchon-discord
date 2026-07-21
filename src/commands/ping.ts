import { performance } from 'node:perf_hooks';
import {
  type ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('핑')
    .setDescription('응답 속도를 측정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    const start = performance.now();
    const loading = new ContainerBuilder()
      .setAccentColor(0x2fa653)
      .addTextDisplayComponents((text) => text.setContent('🏓 측정 중...'));
    await interaction.reply({ components: [loading], flags: MessageFlags.IsComponentsV2 });
    const apiLatency = Math.round(performance.now() - start);

    const wsPing = Math.round(interaction.client.ws.ping);
    const result = new ContainerBuilder().setAccentColor(0x2fa653).addTextDisplayComponents(
      (text) => text.setContent('## 🏓 Pong!'),
      (text) =>
        text.setContent(
          `- 봇 대기 시간: \`${wsPing === -1 ? 'N/A' : `${wsPing}ms`}\`\n- API 지연 시간: \`${apiLatency}ms\``
        )
    );

    await interaction.editReply({ components: [result] });
  }
};
