/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { findGroupChildrenByChildId } from "@api/ContextMenu";
import { MessageObject } from "@api/MessageEvents";
import { updateMessage } from "@api/MessageUpdater";
import { definePluginSettings } from "@api/Settings";
import { LinkIcon } from "@components/Icons";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { Menu, React } from "@webpack/common";

const CLEAR_URLS_JSON_URL = "https://raw.githubusercontent.com/ClearURLs/Rules/master/data.min.json";

interface Provider {
    urlPattern: string;
    completeProvider: boolean;
    rules?: string[];
    rawRules?: string[];
    referralMarketing?: string[];
    exceptions?: string[];
    redirections?: string[];
    forceRedirection?: boolean;
}

interface ClearUrlsData {
    providers: Record<string, Provider>;
}

interface RuleSet {
    name: string;
    urlPattern: RegExp;
    rules?: RegExp[];
    rawRules?: RegExp[];
    exceptions?: RegExp[];
}

const settings = definePluginSettings({
   autoIncoming:{
       displayName: "Apply to Incoming Messages Automatically",
       description: "Automatically remove tracking elements from URLs in messages you receive",
       default: false,
       type: OptionType.BOOLEAN
   }
});

function getSettings() {
    return settings.store;
}

export default definePlugin({
    name: "ClearURLs",
    description: "Automatically removes tracking elements from URLs you send",
    tags: ["Privacy", "Utility"],
    authors: [Devs.adryd, Devs.thororen],

    rules: [] as RuleSet[],

    contextMenus: {
        "message": (children, props) => {
            if (!props.message?.content) return;
            if (!/http(s)?:\/\//.test(props.message?.content)) return;

            const group = findGroupChildrenByChildId("copy-text", children);
            if (!group) return;
            const item = group.find(child => child?.props?.id === "copy-text");
            if (!item) return;
            const index = group.indexOf(item);

            const button = <Menu.MenuItem
                id="clear-urls"
                label={"Clear URLs"}
                leadingAccessory={{ type: "icon", icon: LinkIcon }}
                action={_ => {
                    // @ts-ignore
                    Vencord.Plugins.plugins.ClearURLs.cleanMessage(props.message);
                    updateMessage(props.message.channel_id, props.message.id, props.message);
                }}
                key="clear-urls"/>;

            group.splice(index + 1, 0, button);
        }
    },

    async start() {
        await this.createRules();
    },

    stop() {
        this.rules = [];
    },

    onBeforeMessageSend(_, msg) {
        return this.cleanMessage(msg);
    },

    onBeforeMessageEdit(_cid, _mid, msg) {
        return this.cleanMessage(msg);
    },

    async createRules() {
        const res = await fetch(CLEAR_URLS_JSON_URL)
            .then(res => res.json()) as ClearUrlsData;

        this.rules = [];

        for (const [name, provider] of Object.entries(res.providers)) {
            const urlPattern = new RegExp(provider.urlPattern, "i");

            const rules = provider.rules?.map(rule => new RegExp(rule, "i"));
            const rawRules = provider.rawRules?.map(rule => new RegExp(rule, "i"));
            const exceptions = provider.exceptions?.map(ex => new RegExp(ex, "i"));

            this.rules.push({
                name,
                urlPattern,
                rules,
                rawRules,
                exceptions,
            });
        }
    },

    replacer(match: string) {
        // Parse URL without throwing errors
        try {
            var url = new URL(match);
        } catch (error) {
            // Don't modify anything if we can't parse the URL
            return match;
        }

        // Cheap way to check if there are any search params
        if (url.searchParams.entries().next().done) return match;

        // Check rules for each provider that matches
        this.rules.forEach(({ urlPattern, exceptions, rawRules, rules }) => {
            if (!urlPattern.test(url.href) || exceptions?.some(ex => ex.test(url.href))) return;

            const toDelete: string[] = [];

            if (rules) {
                // Add matched params to delete list
                url.searchParams.forEach((_, param) => {
                    if (rules.some(rule => rule.test(param))) {
                        toDelete.push(param);
                    }
                });
            }

            // Delete matched params from list
            toDelete.forEach(param => url.searchParams.delete(param));

            // Match and remove any raw rules
            let cleanedUrl = url.href;
            rawRules?.forEach(rawRule => {
                cleanedUrl = cleanedUrl.replace(rawRule, "");
            });
            url = new URL(cleanedUrl);
        });

        return url.toString();
    },

    cleanMessage(msg: MessageObject) {
        // Only run on messages that contain URLs
        if (/http(s)?:\/\//.test(msg.content)) {
            msg.content = msg.content.replace(
                /(https?:\/\/[^\s<]+[^<.,:;"'>)|\]\s])/g,
                match => this.replacer(match)
            );
        }
    },
});
