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

import {
	ActionRowBuilder,
	type ModalActionRowComponentBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";
import type InteractionContext from "../models/InteractionContext.js";
import NeedleModal from "../models/NeedleModal.js";

export default class ConfirmFactoryResetModal extends NeedleModal {
	public readonly customId = "confirm-factory-reset";
	public get builder(): ModalBuilder {
		const confirmInput = new TextInputBuilder()
			.setCustomId("confirm")
			.setLabel("Վերականգնե՞լ կարգավորումները (այո/ոչ)")
			.setValue("Այո")
			.setPlaceholder("Ոչ")
			.setRequired(false)
			.setStyle(TextInputStyle.Short);

		const row = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents([confirmInput]);
		return new ModalBuilder()
			.setCustomId(this.customId)
			.setTitle("Վերականգնել Needle-ի կարգավորումները")
			.addComponents(row);
	}

	public async submit(context: InteractionContext): Promise<void> {
		if (!context.isInGuild() || !context.isModalSubmit()) return;

		const { replyInSecret, replyInPublic, interaction, settings } = context;
		const isConfirmed = interaction.fields.getTextInputValue("confirm").toLowerCase() === "այո";
		if (!isConfirmed) {
			return replyInSecret("Գործողությունը չեղարկվեց։");
		}

		const success = this.bot.configs.delete(interaction.guildId);
		return success
			? replyInPublic("Needle-ը հաջողությամբ վերականգնվեց գործարանային կարգավորումներով։")
			: replyInSecret(settings.ErrorNoEffect);
	}
}
