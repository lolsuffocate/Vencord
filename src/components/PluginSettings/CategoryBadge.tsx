/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";
import { classes } from "@utils/misc";
import { PluginCategory } from "@utils/types";
import { Clickable, React, TooltipContainer } from "@webpack/common";

const cl = classNameFactory("vc-plugins-");

type CategoryBadgeProps = {
    category: PluginCategory;
    toggleCategory?: (category: { name: string; description: string }) => void;
    selected?: boolean;
};

export function CategoryBadge({ category, toggleCategory, selected }: CategoryBadgeProps) {
    return (
        <Clickable onClick={() => toggleCategory?.(category)}>
            <TooltipContainer key={category.name}
                              className={classes(cl("category-badge"), selected && "selected")}
                              text={category.description}>
                {category.name}
            </TooltipContainer>
        </Clickable>
    );
}
