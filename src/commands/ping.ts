import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import { ContainerBuilder, MessageFlags } from "discord.js";

@ApplyOptions<Command.Options>({
	name: "핑",
	description: "응답 속도를 측정합니다.",
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const loadingContainer = new ContainerBuilder()
			.setAccentColor(0x00db65)
			.addTextDisplayComponents((text) => text.setContent("🏓 측정 중..."));

		const pingMessage = await interaction.reply({
			components: [loadingContainer],
			flags: MessageFlags.IsComponentsV2,
			withResponse: true,
		});

		const wsPing = Math.round(this.container.client.ws.ping);
		const apiLatency = pingMessage.interaction.createdTimestamp - interaction.createdTimestamp;
		const resultContainer = new ContainerBuilder().setAccentColor(0x00db65).addTextDisplayComponents(
			(text) => text.setContent("## 🏓 Pong!"),
			(text) => text.setContent(`- 봇 대기 시간: \`${wsPing}ms\`\n- API 지연 시간: \`${apiLatency}ms\``),
		);

		return interaction.editReply({ components: [resultContainer] });
	}
}
