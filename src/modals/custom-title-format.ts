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

import { ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { makeRow } from "../helpers/djsHelpers.js";
import NeedleModal from "../models/NeedleModal.js";

export default class CustomTitleFormatModal extends NeedleModal {
	public readonly customId = "custom-title-format";
	public get builder(): ModalBuilder {
		const titleInput = new TextInputBuilder()
			.setCustomId("title")
			.setLabel("Վերնագրի ձևաչափը (կայքարեցված է RegEx)")
			.setRequired(true)
			.setPlaceholder("Օգնություն $USER_NICKNAME - /^[\\S\\s]/g")
			.setStyle(TextInputStyle.Short);
		const maxTitleLength = new TextInputBuilder()
			.setCustomId("maxTitleLength")
			.setLabel("Վերնագրի առավելագույն երկարություն (1-100 թիվ)")
			.setRequired(true)
			.setPlaceholder("50")
			.setStyle(TextInputStyle.Short);
		const regexJoinText = new TextInputBuilder()
			.setCustomId("regexJoinText")
			.setLabel("RegEx միացում (առաջադեմ)")
			.setRequired(false)
			.setPlaceholder("(դատարկ տող)")
			.setStyle(TextInputStyle.Short);

		return new ModalBuilder()
			.setCustomId(this.customId)
			.setTitle("Սահմանել սեփական վերնագրի ձևաչափ")
			.addComponents(makeRow(titleInput), makeRow(maxTitleLength), makeRow(regexJoinText));
	}

	public async submit(): Promise<void> {
		// Not used, we only use openAndAwaitSubmit on this modal
	}
}
