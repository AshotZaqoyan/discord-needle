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

import type AutothreadChannelConfig from "./AutothreadChannelConfig.js";
import type Setting from "./enums/Setting.js";

export default interface NeedleConfig {
	threadChannels: AutothreadChannelConfig[];
	settings: {
		[K in SettingKeys]: string;
	};
}

export const defaultConfig: NeedleConfig = {
	threadChannels: [],
	settings: {
		ErrorUnknown: "Տեղի ունեցավ անհայտ սխալ։ Խնդրում ենք փորձել ավելի ուշ։",
		ErrorOnlyInThread: "Այս գործողությունը հնարավոր է միայն թրեդում։",
		ErrorNoEffect: "Այս գործողությունը ազդեցություն չի ունենա։",
		ErrorInsufficientUserPerms: "Դուք չունեք այս գործողությունը կատարելու թույլտվություն։",
		ErrorInsufficientBotPerms: "Բոտը չունի այս գործողությունը կատարելու թույլտվություն։",
		ErrorMaxThreadRenames: "Թրեդը կարելի է վերանվանել 10 րոպեում միայն երկու անգամ։ Խնդրում ենք փորձել ավելի ուշ։",

		SuccessThreadCreated: "Թրեդը ավտոմատ ստեղծվել է $USER_NICKNAME-ի կողմից $CHANNEL_MENTION-ում",
		SuccessThreadArchived:
			"Թրեդը արխիվացվել է $USER_NICKNAME-ի կողմից։ Ցանկացածը կարող է հաղորդագրություն ուղարկել՝ այն ապարխիվացնելու համար։",

		EmojiUnanswered: "🆕",
		EmojiArchived: "✅",
		EmojiLocked: "🔒",
	},
};

type SettingKeys = keyof typeof Setting;
