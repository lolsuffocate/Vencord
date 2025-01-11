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

function setAlpha(sixCharHex: string, alpha: number) {
    const hex = sixCharHex.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function CategoryBadge({ category, toggleCategory, selected }: CategoryBadgeProps) {
    return (
        <Clickable onClick={() => toggleCategory?.(category)}
                   style={category.color ? {
                       outlineColor: category.color,
                       "--button-filled-brand-background": setAlpha(category.color, 0.7),
                       "--button-filled-brand-background-hover": setAlpha(category.color, 0.5)
                   } as React.CSSProperties : {}}
        >
            <TooltipContainer key={category.name}
                              className={classes(cl("category-badge"), selected && "selected")}
                              text={category.description}>
                {category.name}
            </TooltipContainer>
        </Clickable>
    );
}
