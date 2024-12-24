/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs, PluginCategories } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "FixYoutubeEmbeds",
    description: "Bypasses youtube videos being blocked from display on Discord (for example by UMG)",
    authors: [Devs.coolelectronics],
    categories: [PluginCategories.TWEAKS]
});
