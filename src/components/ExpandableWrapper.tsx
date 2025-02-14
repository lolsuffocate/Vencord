/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./ExpandableWrapper.css";

import { classNameFactory } from "@api/Styles";
import { classes } from "@utils/misc";
import { findComponentByCodeLazy } from "@webpack";
import { Clickable, React, TooltipContainer, useLayoutEffect, useRef, useState } from "@webpack/common";

const ExpandIcon = findComponentByCodeLazy("M5.3 9.3a1");
const cl = classNameFactory("expandable-wrapper-");
const DEFAULT_COLLAPSE_TO = 200;
const DEFAULT_COLLAPSE_IF_OVER = 200;

interface ExpandableWrapperProps {
    children: React.JSX.Element;
    collapseTo?: number;
    collapseIfOver?: number;
    defaultExpanded?: boolean;
    overlayWhenCollapsed?: boolean;
    overlayWhenExpanded?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

export default function ExpandableWrapper({
    children,
    collapseTo = DEFAULT_COLLAPSE_TO,
    collapseIfOver = DEFAULT_COLLAPSE_IF_OVER,
    defaultExpanded = false,
    overlayWhenCollapsed = true,
    overlayWhenExpanded = false,
    className,
    style = {}
}: ExpandableWrapperProps) {
    const [expanded, setExpanded] = useState(defaultExpanded ?? false);
    const [isTallerThanLimit, setIsTallerThanLimit] = useState(false);
    const childRef = useRef<HTMLDivElement>(null);

    if (collapseIfOver < 0) collapseIfOver = 0;
    if (collapseTo < 0) collapseTo = 0;
    if (collapseTo > collapseIfOver) collapseTo = collapseIfOver;

    useLayoutEffect(() => {
        if (!childRef.current) return;

        const { height } = childRef.current.getBoundingClientRect();
        setIsTallerThanLimit(height > collapseIfOver);

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    const { height } = entry.target.getBoundingClientRect();
                    setIsTallerThanLimit(height > collapseIfOver);
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(childRef.current);

        return () => observer.disconnect();
    }, [childRef, collapseIfOver]);

    return (
        <div
            className={classes(cl("container"), expanded && "expanded", className)}
            style={isTallerThanLimit ? { maxHeight: expanded ? "none" : collapseTo } : {
                maxHeight: collapseIfOver
            }}
        >
            <div ref={childRef} style={style}>
                {children}
            </div>
            {isTallerThanLimit &&
                <Clickable
                    onClick={() => setExpanded(!expanded)}
                    className={classes(cl("button"), (!overlayWhenExpanded && expanded) && "expanded")}
                    style={{
                        position: expanded ? (overlayWhenExpanded ? "absolute" : "relative") : (overlayWhenCollapsed ? "absolute" : "relative")
                    }}
                >
                    <TooltipContainer text={Math.round(childRef.current?.getBoundingClientRect().height ?? 0) + "px"}>
                        <ExpandIcon className={classes(cl("expand-icon"), expanded && "expanded")}/>
                    </TooltipContainer>
                </Clickable>
            }
        </div>
    );
}
