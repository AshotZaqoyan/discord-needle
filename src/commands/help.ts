/*
This file is part of Needle.

Needle is free software: you can redistribute it and/or modify it under the terms of the GNU
Affero General Public License as published by the Free Software Foundation, either version 3 of
the License, or (at your option) any later version.

Needle is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with Needle.
If not, see <https://www.gnu.org/licenses/>.
*/

import { EmbedBuilder, type GuildMember, type GuildTextBasedChannel, type SlashCommandBuilder } from "discord.js";
import type { Nullish, SlashCommandBuilderWithOptions } from "../helpers/typeHelpers.js";
import CommandCategory from "../models/enums/CommandCategory.js";
import type InteractionContext from "../models/InteractionContext.js";
import NeedleCommand from "../models/NeedleCommand.js";

export default class HelpCommand extends NeedleCommand {
	public readonly name = "help";
	public readonly description = "Դիտել Needle-ի հրամանները";
	public readonly category = CommandCategory.Info;

	private readonly EMBED_COLOR = "#2f3136";
	private readonly SUPPORT_SERVER_URL = "https://discord.gg/8BmnndXHp6";

	public addOptions(builder: SlashCommandBuilder): SlashCommandBuilderWithOptions {
		return builder.addStringOption(option =>
			option
				.setName("filter")
				.setDescription("Ո՞ր հրամաններն եք ցանկանում տեսնել")
				.addChoices(
					{ name: "Այստեղ հասանելի հրամաններ (լռելյայն)", value: "default" },
					{ name: "Needle-ի բոլոր հրամանները", value: "all" },
				),
		);
	}

	public async execute(context: InteractionContext): Promise<void> {
		const isInGuild = context.isInGuild();
		const member = isInGuild ? context.interaction.member : null;
		const channel = isInGuild ? context.interaction.channel : null;
		const showAll = context.isSlashCommand() && context.interaction.options.getString("filter") === "all";

		const commandsEmbed = await this.getCommandsEmbed(member, channel, showAll);

		await context.interaction.reply({
			content: ``,
			embeds: [commandsEmbed],
			ephemeral: true,
		});
	}

	private async getCommandsEmbed(
		member: Nullish<GuildMember>,
		channel: Nullish<GuildTextBasedChannel>,
		showAll: boolean,
	): Promise<EmbedBuilder> {
		const commands = await this.bot.getAllCommands();

		const fields = [];
		let seeingAllCommands = true;
		for (const category of Object.values(CommandCategory)) {
			const commandsInCategory = commands.filter(cmd => cmd.category === category);
			const descriptions = await this.getCommandDescriptions(commandsInCategory, member, channel, showAll);

			if (commandsInCategory.length !== descriptions.length) {
				seeingAllCommands = false;
			}

			if (descriptions.length > 0) {
				fields.push({ name: category, value: descriptions.join("\n") });
			}
		}

		if (fields.length === 0) {
			return new EmbedBuilder()
				.setColor(this.EMBED_COLOR)
				.setDescription("Դուք այստեղ չունեք Needle-ի որևէ հրաման օգտագործելու թույլտվություն։");
		}

		const builder = new EmbedBuilder().setColor(this.EMBED_COLOR).setFields(fields);
		if (!seeingAllCommands) {
			builder.setFooter({
				text: 'Ցույց ենք տալիս միայն այս ալիքում ձեզ հասանելի հրամանները։\nՕգտագործեք "/help filter: all"՝ բոլոր հրամանները տեսնելու համար 👈',
			});
		}

		return builder;
	}

	private async getCommandDescriptions(
		commands: NeedleCommand[],
		member: Nullish<GuildMember>,
		channel: Nullish<GuildTextBasedChannel>,
		showAll: boolean,
	): Promise<string[]> {
		const output = [];
		for (const command of commands) {
			const { id, description, name } = command;

			const hasPermission = await command.hasPermissionToExecuteHere(member, channel);
			if (!showAll && hasPermission === false) continue;

			const commandSyntax = `</${name}:${id}>`;
			output.push(`${commandSyntax} — ${description}`);
		}

		return output;
	}
}
