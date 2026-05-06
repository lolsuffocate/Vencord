/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import CollapsibleContainer from "@components/CollapsibleContainer";
import { Devs } from "@utils/constants";
import definePlugin, { makeRange, OptionType } from "@utils/types";

const settings = definePluginSettings({
    overlayCollapseButtonWhenExpanded: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Overlay the collapse button when the content is expanded"
    },

    collapseIfOver: {
        type: OptionType.SLIDER,
        default: 400,
        markers: makeRange(0, 1000, 50),
        stickToMarkers: true,
        description: "Collapse the content if it's over this height"
    },

    collapseTo: {
        type: OptionType.SLIDER,
        default: 200,
        markers: makeRange(0, 1000, 50),
        stickToMarkers: true,
        description: "Collapse the content to this height"
    }
});

export const ReactiveExpandableWrapper = props => {
    const expandSettings = settings.use(["overlayCollapseButtonWhenExpanded", "collapseIfOver", "collapseTo"]);

    return (
        <CollapsibleContainer collapseTo={expandSettings?.collapseTo ?? 200}
                              collapseIfOver={expandSettings?.collapseIfOver ?? 400}
                              overlayWhenExpanded={expandSettings?.overlayCollapseButtonWhenExpanded ?? true}
                              scrollableWhenCollapsed={false}
        >
            {props.children}
        </CollapsibleContainer>
    );
};

export default definePlugin({
    name: "CollapsibleEmbeds",
    description: "Collapse embeds that are over a certain height",
    authors: [Devs.Suffocate],
    settings,
    patches: [
        {
            /** Collapsible code blocks */
            find: ".codeActions,children:",
            replacement: [
                {
                    match: /(return\(0,\i\.jsx\)\("pre",\{children:)(\(0,\i\.jsxs\)\("div",\{.*?\))(},\i\.key\))/,
                    replace: "$1 $self.wrapInExpandable($2) $3"
                }
            ]
        },
        {
            /** Collapsible embeds */
            find: "this.renderAttachments(",
            replacement: {
                match: /this\.renderEmbed\(\i,\i,\i,\i\)/g,
                replace: "$self.wrapInExpandable($&)"
            }
        }
    ],

    wrapInExpandable: orig => {
        // the expandable wrapper breaks the size of the video in youtube embeds
        // and no video embed is going to be tall enough to need it anyway
        if (orig?.props?.children?.props?.embed?.provider?.url === "https://www.youtube.com" ||
        orig?.props?.children?.props?.embed?.provider?.url === "https://www.youtube.com/" ||
            orig?.props?.children?.props?.embed?.url?.startsWith("https://youtube.com/") ||
            orig?.props?.children?.props?.embed?.url?.startsWith("https://www.twitch.tv/")
        ) {
            return orig;
        }
        return <ReactiveExpandableWrapper>{orig}</ReactiveExpandableWrapper>;
    }
});
