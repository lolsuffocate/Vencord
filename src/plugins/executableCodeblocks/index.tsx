/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addAccessory, removeAccessory } from "@api/MessageAccessories";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { Heading, React } from "@webpack/common";

import { ExecuteAccessory } from "./ExecuteAccessory";
import QuickCssManager from "./QuickCssManager";

export const settings = definePluginSettings({
    showCodeWarning: {
        description: "Show warning before running JavaScript/TypeScript code",
        type: OptionType.BOOLEAN,
        default: true,
    },
    divider: {
        type: OptionType.COMPONENT,
        description: "",
        component() {
            return <div style={{
                background: "var(--background-modifier-accent)",
                margin: "10px 0",
                width: "100%",
                height: "1px"
            }}/>;
        }
    },
    htmlTitle: {
        description: "Title of the HTML codeblock",
        type: OptionType.COMPONENT,
        component() {
            return <Heading
                style={{
                    color: "var(--header-primary)"
                }}>HTML</Heading>;
        }
    },
    iframeOptionsTitle: {
        description: "Title of the iframe options",
        type: OptionType.COMPONENT,
        component() {
            return <><Heading
                style={{
                    color: "var(--header-primary)"
                }}>iFrame Options</Heading>
                <p style={{ color: "red" }}>
                    These options can be dangerous, don't touch if you don't know what you're doing
                </p>
            </>;
        }
    },
    iframeOptions: {
        description: "Sandbox options for the iframe that HTML codeblocks will be rendered in",
        type: OptionType.MULTISELECT,
        clearable: true,
        options: [
            { label: "Allow Forms", value: "allow-forms" },
            { label: "Allow Modals", value: "allow-modals" },
            { label: "Allow Orientation Lock", value: "allow-orientation-lock" },
            { label: "Allow Pointer Lock", value: "allow-pointer-lock" },
            { label: "Allow Popups", value: "allow-popups" },
            { label: "Allow Popups to Escape Sandbox", value: "allow-popups-to-escape-sandbox" },
            { label: "Allow Presentation", value: "allow-presentation" },
            { label: "Allow Same Origin", value: "allow-same-origin" },
            { label: "Allow Scripts", value: "allow-scripts" },
            { label: "Allow Top Navigation", value: "allow-top-navigation" },
            { label: "Allow Top Navigation by User Activation", value: "allow-top-navigation-by-user-activation" }
        ]
    }
});

export default definePlugin({
    name: "ExecutableCodeblocks",
    description: "Allows you to execute html and js codeblocks in Discord",
    authors: [{ name: "Suffocate", id: 772601756776923187n }],
    dependencies: ["MessageAccessoriesAPI"],
    settings,

    async start() {
        if(!QuickCssManager.getInstance().isSetUp()) QuickCssManager.getInstance().setQuickCssContents(await VencordNative.quickCss.get());
        addAccessory("executable-codeblocks", props => <ExecuteAccessory {...props}/>);
    },

    async stop() {
        removeAccessory("executable-codeblocks");
    }
});
