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
	ChannelType,
	type GuildMember,
	type GuildTextBasedChannel,
	PermissionFlagsBits,
	type SlashCommandBuilder,
} from "discord.js";
import type { SlashCommandBuilderWithOptions, SameLengthTuple, Nullish } from "../helpers/typeHelpers.js";
import AutothreadChannelConfig from "../models/AutothreadChannelConfig.js";
import CommandCategory from "../models/enums/CommandCategory.js";
import ReplyMessageOption from "../models/enums/ReplyMessageOption.js";
import TitleType from "../models/enums/TitleType.js";
import ToggleOption from "../models/enums/ToggleOption.js";
import type InteractionContext from "../models/InteractionContext.js";
import NeedleCommand from "../models/NeedleCommand.js";
import safe_regex from "safe-regex";
import { extractRegex, removeInvalidThreadNameChars } from "../helpers/stringHelpers.js";
import DeleteBehavior from "../models/enums/DeleteBehavior.js";
import ReplyButtonsOption from "../models/enums/ReplyButtonsOption.js";
import type { ModalTextInput } from "../models/ModalTextInput.js";

export default class AutoThreadCommand extends NeedleCommand {
	public readonly name = "auto-thread";
	public readonly description = "Կարգավորել թրեդերի ավտոմատ ստեղծումը ալիքում";
	public readonly category = CommandCategory.Configuration;
	protected readonly defaultPermissions = PermissionFlagsBits.ManageThreads;

	public async hasPermissionToExecuteHere(
		member: Nullish<GuildMember>,
		channel: Nullish<GuildTextBasedChannel>,
	): Promise<boolean> {
		if (channel?.isThread()) return false;
		if (channel?.isVoiceBased()) return false;
		return super.hasPermissionToExecuteHere(member, channel);
	}

	public async execute(context: InteractionContext): Promise<void> {
		if (!context.isInGuild() || !context.isSlashCommand()) return;

		const { interaction, settings, replyInSecret, replyInPublic } = context;
		const { guild, guildId, options } = interaction;
		const channelId = options.getChannel("channel")?.id ?? interaction.channel.id;
		const targetChannel = await guild?.channels.fetch(channelId);

		if (!targetChannel) return;

		const botMember = await guild?.members.fetchMe();
		const botPermissions = botMember?.permissionsIn(targetChannel);

		if (!botPermissions?.has(PermissionFlagsBits.ViewChannel)) {
			return replyInSecret("Needle-ը չունի այս ալիքը տեսնելու թույլտվություն");
		}

		if (!botPermissions.has(PermissionFlagsBits.CreatePublicThreads)) {
			return replyInSecret("Needle-ը չունի այս ալիքում թրեդեր ստեղծելու թույլտվություն");
		}

		if ((options.getInteger("slowmode") ?? 0) > 0 && !botPermissions?.has(PermissionFlagsBits.ManageThreads)) {
			return replyInSecret(
				'Needle-ին անհրաժեշտ է "Manage Threads" թույլտվությունը թրեդում դանդաղ ռեժիմ սահմանելու համար',
			);
		}

		if (options.getInteger("status-reactions") && !botPermissions?.has(PermissionFlagsBits.AddReactions)) {
			return replyInSecret(
				'Needle-ին անհրաժեշտ է "Add Reactions" թույլտվությունը հաղորդագրություններին ռեակցիաներ ավելացնելու համար',
			);
		}

		const guildConfig = this.bot.configs.get(guildId);
		const oldConfigIndex = guildConfig.threadChannels.findIndex(c => c.channelId === channelId);
		const oldAutoThreadConfig = oldConfigIndex > -1 ? guildConfig.threadChannels[oldConfigIndex] : undefined;
		const openTitleModal = options.getInteger("title-format") === TitleType.Custom;
		const openReplyButtonsModal = options.getInteger("reply-buttons") === ReplyButtonsOption.Custom;
		const replyType = options.getInteger("reply-message");
		const openReplyMessageModal = replyType === ReplyMessageOption.Custom;

		if (targetChannel?.isThread() || targetChannel?.isVoiceBased()) {
			return replyInSecret("Այս տեսակի ալիքում հնարավոր չէ ստեղծել թրեդեր։");
		}

		if (options.getInteger("toggle") === ToggleOption.Off) {
			if (!oldAutoThreadConfig) {
				return replyInSecret(settings.ErrorNoEffect);
			}

			guildConfig.threadChannels.splice(oldConfigIndex, 1);
			this.bot.configs.set(guildId, guildConfig);
			return replyInPublic(`Ավտո-թրեդը հանվեց <#${channelId}> ալիքում`);
		}

		if (+openTitleModal + +openReplyMessageModal + +openReplyButtonsModal > 1) {
			return replyInSecret("Խնդրում ենք միաժամանակ միայն մեկ ընտրանք սահմանել «Custom»։");
		}

		let newCustomTitle;
		let newMaxTitleLength;
		let newRegexJoinText;
		if (openTitleModal) {
			const oldTitle = oldAutoThreadConfig?.customTitle ?? "/^[\\S\\s]/g";
			const oldMaxLength = oldAutoThreadConfig?.titleMaxLength ?? 50;
			const oldJoinText = oldAutoThreadConfig?.regexJoinText ?? "";
			let newMaxLengthString;
			[newCustomTitle, newMaxLengthString, newRegexJoinText] = await this.getTextInputsFromModal(
				"custom-title-format",
				[
					{ customId: "title", value: oldTitle },
					{ customId: "maxTitleLength", value: oldMaxLength.toString() },
					{ customId: "regexJoinText", value: oldJoinText },
				],
				context,
			);

			newMaxTitleLength = Number.parseInt(newMaxLengthString);
			if (Number.isNaN(newMaxTitleLength) || newMaxTitleLength < 1 || newMaxTitleLength > 100) {
				return replyInSecret(newMaxLengthString + " թիվ չէ 1-100 միջակայքում։");
			}

			const hasMoreThanTwoSlashes = newCustomTitle.split("/").length - 1 > 2;
			if (hasMoreThanTwoSlashes) {
				return replyInSecret("Սեփական վերնագրերը չեն կարող ունենալ մեկից ավելի regex։");
			}

			const { inputWithRegexVariable, regex } = extractRegex(newCustomTitle);
			if (regex && !safe_regex(regex)) {
				return replyInSecret("Անվտանգ չէ regex-ը, խնդրում ենք փորձել անվտանգ regex-ով։");
			}

			if (removeInvalidThreadNameChars(inputWithRegexVariable).length === 0) {
				return replyInSecret("Անվավեր վերնագիր, խնդրում ենք ապահովել գոնե մեկ վավեր նշան։");
			}
		}

		if (options.getInteger("title-format") !== TitleType.Custom) {
			newMaxTitleLength = 50;
		}

		let newReplyMessage;
		if (openReplyMessageModal) {
			const oldReplyType = oldAutoThreadConfig?.replyType;
			const wasUsingDefaultReply = oldReplyType === ReplyMessageOption.Default;
			const oldValue = wasUsingDefaultReply
				? settings.SuccessThreadCreated
				: oldAutoThreadConfig?.customReply ?? "";
			[newReplyMessage] = await this.getTextInputsFromModal(
				"custom-reply-message",
				[{ customId: "message", value: oldValue }],
				context,
			);
		}

		if (replyType === ReplyMessageOption.Default) {
			newReplyMessage = "";
		}

		let newCloseButtonText;
		let newCloseButtonStyle;
		let newTitleButtonText;
		let newTitleButtonStyle;
		if (openReplyButtonsModal) {
			// TODO: This default is defined in like 3 places, need to have a default config somewhere probably..
			const oldCloseText = oldAutoThreadConfig?.closeButtonText ?? "Արխիվացնել թրեդը";
			const oldCloseStyle = oldAutoThreadConfig?.closeButtonStyle ?? "green";
			const oldTitleText = oldAutoThreadConfig?.titleButtonText ?? "Խմբագրել վերնագիրը";
			const oldTitleStyle = oldAutoThreadConfig?.titleButtonStyle ?? "blurple";

			[newCloseButtonText, newCloseButtonStyle, newTitleButtonText, newTitleButtonStyle] =
				await this.getTextInputsFromModal(
					"custom-reply-buttons",
					[
						{ customId: "closeText", value: oldCloseText },
						{ customId: "closeStyle", value: oldCloseStyle },
						{ customId: "titleText", value: oldTitleText },
						{ customId: "titleStyle", value: oldTitleStyle },
					],
					context,
				);

			if (!this.isValidButtonStyle(newCloseButtonStyle) || !this.isValidButtonStyle(newTitleButtonStyle)) {
				return replyInSecret("Կոճակի սխալ ոճ։ Թույլատրելի արժեքներ՝ blurple/grey/green/red։");
			}
		}

		if (options.getInteger("reply-buttons") === ReplyButtonsOption.Default) {
			newCloseButtonText = "Արխիվացնել թրեդը";
			newCloseButtonStyle = "green";
			newTitleButtonText = "Խմբագրել վերնագիրը";
			newTitleButtonStyle = "blurple";
		}

		const newAutoThreadConfig = new AutothreadChannelConfig(
			oldAutoThreadConfig,
			channelId,
			options.getInteger("delete-behavior"),
			options.getInteger("archive-behavior"),
			options.getInteger("include-bots"),
			options.getInteger("slowmode"),
			options.getInteger("status-reactions"),
			options.getInteger("reply-message"),
			newReplyMessage,
			options.getInteger("title-format"),
			newMaxTitleLength,
			newRegexJoinText,
			newCustomTitle,
			newCloseButtonText,
			newCloseButtonStyle,
			newTitleButtonText,
			newTitleButtonStyle,
		);

		if (JSON.stringify(oldAutoThreadConfig) === JSON.stringify(newAutoThreadConfig)) {
			return replyInSecret(settings.ErrorNoEffect);
		}

		let interactionReplyMessage;
		if (oldConfigIndex > -1) {
			interactionReplyMessage = `Ավտո-թրեդի կարգավորումները թարմացվեցին <#${channelId}> ալիքում`;
			guildConfig.threadChannels[oldConfigIndex] = newAutoThreadConfig;
		} else {
			interactionReplyMessage = `Ավտո-թրեդը միացվեց <#${channelId}> ալիքում`;
			guildConfig.threadChannels.push(newAutoThreadConfig);
		}

		this.bot.configs.set(guildId, guildConfig);
		return replyInPublic(interactionReplyMessage);
	}

	private async getTextInputsFromModal<T extends ModalTextInput[]>(
		modalName: string,
		inputs: T,
		context: InteractionContext,
	): Promise<SameLengthTuple<T, string>> {
		if (!context.isModalOpenable()) return inputs.map(() => "") as SameLengthTuple<T, string>;

		const customTitleModal = this.bot.getModal(modalName);
		const submitInteraction = await customTitleModal.openAndAwaitSubmit(context.interaction, inputs);
		context.setInteractionToReplyTo(submitInteraction);
		return inputs.map(x => submitInteraction.fields.getTextInputValue(x.customId)) as SameLengthTuple<T, string>;
	}

	// Temporary thing before we get dropdowns in modals
	private isValidButtonStyle(setting: string | undefined): boolean {
		switch (setting?.toLowerCase()) {
			case "blurple":
			case "green":
			case "grey":
			case "red":
				return true;
			default:
				return false;
		}
	}

	public addOptions(builder: SlashCommandBuilder): SlashCommandBuilderWithOptions {
		return builder
			.addChannelOption(option =>
				option
					.setName("channel")
					.setDescription("Որ ալիքը? Լռելյայն՝ ընթացիկ ալիքը։")
					.addChannelTypes(ChannelType.GuildText, ChannelType.GuildNews),
			)
			.addIntegerOption(option =>
				option
					.setName("toggle")
					.setDescription("Ավտո-թրեդը միացվա՞ծ լինի, թե՞ անջատված։")
					.addChoices(
						{ name: "Ավտո-թրեդը միացված (լռելյայն)", value: ToggleOption.On },
						{ name: "Ավտո-թրեդը անջատված", value: ToggleOption.Off },
					),
			)
			.addIntegerOption(option =>
				option
					.setName("title-format")
					.setDescription("Ինչպե՞ս լինի թրեդի վերնագիրը։ 🔥")
					.addChoices(
						{ name: "Հաղորդագրության առաջին 50 նիշերը (լռելյայն)", value: TitleType.FirstFiftyChars },
						{ name: "Մականուն (yyyy-MM-dd) 🔥", value: TitleType.NicknameDate },
						{ name: "Հաղորդագրության առաջին տողը", value: TitleType.FirstLineOfMessage },
						{ name: "Սեփական 🔥", value: TitleType.Custom },
					),
			)
			.addIntegerOption(option =>
				option
					.setName("reply-message")
					.setDescription("Ինչպե՞ս պետք է Needle-ը պատասխան տա թրեդում? 🔥")
					.addChoices(
						{
							name: 'Օգտագործել "SuccessThreadCreate" կարգավորումը (լռելյայն)',
							value: ReplyMessageOption.Default,
						},
						{ name: "Սեփական հաղորդագրություն 🔥", value: ReplyMessageOption.Custom },
					),
			)
			.addIntegerOption(option =>
				option.setName("reply-buttons").setDescription("Ինչ տեսք ունենան պատասխանի կոճակները?").addChoices(
					{
						name: "Կանաչ արխիվացման կոճակ, blurple խմբագրման կոճակ (լռելյայն)",
						value: ReplyButtonsOption.Default,
					},
					{ name: "Սեփական 🔥", value: ReplyButtonsOption.Custom },
				),
			)
			.addIntegerOption(option =>
				option
					.setName("include-bots")
					.setDescription("Թրեդերը ստեղծվեն բոտերի հաղորդագրությունների՞ համար")
					.addChoices(
						{ name: "Բացառել բոտերը (լռելյայն)", value: ToggleOption.Off },
						{ name: "Ներառել բոտերը", value: ToggleOption.On },
					),
			)
			.addIntegerOption(option =>
				option
					.setName("delete-behavior")
					.setDescription("Ի՞նչ անել թրեդը, եթե մեկնարկային հաղորդագրությունը ջնջվի?")
					.addChoices(
						{
							name: "Ջնջել, եթե թրեդը դատարկ է, այլապես արխիվացնել (լռելյայն)",
							value: DeleteBehavior.DeleteIfEmptyElseArchive,
						},
						{ name: "Միշտ արխիվացնել", value: DeleteBehavior.Archive },
						{ name: "Միշտ ջնջել ❗", value: DeleteBehavior.Delete },
						{ name: "Ոչինչ չանել", value: DeleteBehavior.Nothing },
					),
			)
			.addIntegerOption(option =>
				option
					.setName("archive-behavior")
					.setDescription("Ինչ պետք է տեղի ունենա, երբ օգտատերերը փակեն թրեդը?")
					.addChoices(
						{ name: "Արխիվացնել անմիջապես (լռելյայն)", value: ToggleOption.On },
						{ name: "Թաքցնել 1 ժամ անգործությունից հետո", value: ToggleOption.Off },
					),
			)
			.addIntegerOption(option =>
				option
					.setName("status-reactions")
					.setDescription("Թրեդի կարգավիճակներն արտացոլե՞ն ռեակցիաներով")
					.addChoices(
						{ name: "Ռեակցիաները անջատված (լռելյայն)", value: ToggleOption.Off },
						{ name: "Ռեակցիաները միացված", value: ToggleOption.On },
					),
			)
			.addIntegerOption(option =>
				option
					.setName("slowmode")
					.setDescription("Որքա՞ն լինի դանդաղ ռեժիմը ստեղծված թրեդերում?")
					.addChoices(
						{ name: "Անջատված (լռելյայն)", value: 0 },
						{ name: "1 վայրկյան", value: 1 },
						{ name: "5 վայրկյան", value: 5 },
						{ name: "30 վայրկյան", value: 30 },
						{ name: "1 րոպե", value: 60 },
						{ name: "5 րոպե", value: 300 },
						{ name: "15 րոպե", value: 900 },
						{ name: "1 ժամ", value: 3600 },
						{ name: "6 ժամ", value: 21600 },
					),
			);
	}
}
