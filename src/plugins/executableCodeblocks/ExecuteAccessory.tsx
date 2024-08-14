/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { popNotice, showNotice } from "@api/Notices";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, ModalSize } from "@utils/modal";
import { Alerts, React, ReactDOM, useEffect, useRef, useState } from "@webpack/common";
import { Channel, Message } from "discord-types/general";

import { settings } from "./index";
import QuickCssManager from "./QuickCssManager";

let rerender = (id: string) => {
    console.error("rerender not set for id:", id);
};

function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export function ExecuteAccessory(props: Record<string, any>) {
    const { message, channel } = props;
    // match ```html\n(code)``` or ```js\n(code)``` or ```css\n(code)``` or ```less\n(code)```
    // i did also include typescript but transpiling ts into js means importing the typescript lib and that massively increases the renderer file size
    if (!message.content.match(/```(html|js|css|less|javascript)\n.+```/si)) return null;

    /* if any of these states change it requires a re-render */
    const [quickCssContents, setQuickCssContents] = useState<string>(QuickCssManager.getInstance().getQuickCssContents());

    // I don't really like having a listener per component but it seems to be the only way to reliably update the state and re-render when the QuickCSS changes
    VencordNative.quickCss.addChangeListener(setQuickCssContents);

    // multiple codeblocks per message, so multiple states and portals per message
    const [rerenderer, setRerenderTrigger] = useState<number>(0);
    const [_portals, set_portals] = useState<Map<string, React.ReactPortal>>(new Map());
    const [_isCssApplied, _setCssApplied] = useState<Map<string, boolean>>(new Map()); // codeblock id -> isCssApplied
    const [_isCssChanged, _setCssChanged] = useState<Map<string, boolean>>(new Map()); // codeblock id -> isCssChanged
    const [_isInQuickCss, _setQuickCssAdded] = useState<Map<string, boolean>>(new Map()); // codeblock id -> isInQuickCss
    const [_isQuickCssChanged, _setQuickCssChanged] = useState<Map<string, boolean>>(new Map()); // codeblock id -> isQuickCssChanged
    const [_isOpenInline, _setIsOpenInline] = useState<Map<string, boolean>>(new Map()); // codeblock id -> isOpenInline
    const [_languages, _setLanguages] = useState<Map<string, string>>(new Map()); // codeblock id -> language

    // this doesn't require a re-render because the iframe already exists, we're just changing the visibility, so we use ref instead of state
    const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map()); // codeblock id -> iframeRef

    // add a ref to the iframeRefs map, which is used to check if the iframe is already in the map
    const addIframeRef = (id: string, ref: HTMLIFrameElement | null) => {
        if (ref) iframeRefs.current.set(id, ref);
        else iframeRefs.current.delete(id);
    };

    function getQuickCssStr() {
        return QuickCssManager.getInstance().getQuickCssContents();
    }

    // all state changes have a check to see if the value is already set to prevent unnecessary rerenders (and to prevent infinite loops)

    // one portal per codeblock, each will display below the codeblock within the message containing multiple buttons
    const addPortal = (id: string, reactElement: React.ReactNode, container: Element) => {
        const shikiBtns = container.querySelector(".shiki-btns");
        if (shikiBtns) container = shikiBtns;
        const portal = ReactDOM.createPortal(reactElement, container);
        if (_portals.has(id) && _portals.get(id) === portal) return;
        set_portals(prev => {
            const copy = new Map(prev);
            copy.set(id, portal);
            return copy;
        });
    };

    const setCssAppliedForId = (id: string, value: boolean) => {
        if (_isCssApplied.get(id) === value) return;
        _setCssApplied(prev => {
            const copy = new Map(prev);
            copy.set(id, value);
            return copy;
        });
    };

    const getCssAppliedForId = (id: string) => {
        if (_isCssApplied.has(id)) return _isCssApplied.get(id);
        else return false;
    };

    const setCssChangedForId = (id: string, value: boolean) => {
        if (_isCssChanged.get(id) === value) return;
        _setCssChanged(prev => {
            const copy = new Map(prev);
            copy.set(id, value);
            return copy;
        });
    };

    const getCssChangedForId = (id: string) => {
        if (_isCssChanged.has(id)) return _isCssChanged.get(id);
        else return false;
    };

    const setQuickCssAddedForId = (id: string, value: boolean) => {
        if (_isInQuickCss.get(id) === value) return;
        _setQuickCssAdded(prev => {
            const copy = new Map(prev);
            copy.set(id, value);
            return copy;
        });
    };

    const getQuickCssAddedForId = (id: string) => {
        if (_isInQuickCss.has(id)) return _isInQuickCss.get(id);
        else return false;
    };

    const setQuickCssChangedForId = (id: string, value: boolean) => {
        if (_isQuickCssChanged.get(id) === value) return;
        _setQuickCssChanged(prev => {
            const copy = new Map(prev);
            copy.set(id, value);
            return copy;
        });
    };

    const getQuickCssChangedForId = (id: string) => {
        if (_isQuickCssChanged.has(id)) return _isQuickCssChanged.get(id);
        else return false;
    };

    const setIsOpenInlineForId = (id: string, value: boolean) => {
        if (_isOpenInline.get(id) === value) return;
        _setIsOpenInline(prev => {
            const copy = new Map(prev);
            copy.set(id, value);
            return copy;
        });
    };

    const getIsOpenInlineForId = (id: string) => {
        if (_isOpenInline.has(id)) return _isOpenInline.get(id);
        else return false;
    };

    const setLanguageForId = (id: string, value: string) => {
        if (_languages.get(id) === value) return;
        _setLanguages(prev => {
            const copy = new Map(prev);
            copy.set(id, value);
            return copy;
        });
    };

    const isShikiCodeblock = (codeblock: HTMLElement) => {
        const { parentElement } = codeblock;
        return parentElement && parentElement.classList.contains("shiki-root");
    };

    const getCodeblockCode = (codeblock: HTMLElement) => {
        if (!codeblock) return "";
        if (isShikiCodeblock(codeblock)) {
            let code = "";
            codeblock.querySelectorAll("table > tr > td:has(span)").forEach(el => {
                code += el.textContent + "\n";
            });
            return code;
        } else {
            return codeblock.textContent ? codeblock.textContent : "";
        }
    };

    const getCodeblockLanguage = (codeblock: HTMLElement, fromObserver: boolean = false) => {
        if (isShikiCodeblock(codeblock)) {
            const lang = codeblock.querySelector("div.shiki-lang")?.textContent;
            if (lang) return lang.toLowerCase();
            else return null;
        } else {
            const code = codeblock.className.toLowerCase().split(" ");
            if (code.includes("html")) return "html";
            else if (code.includes("js")) return "js";
            else if (code.includes("javascript")) return "js";
            else if (code.includes("css")) return "css";
            else if (code.includes("less")) return "less";
            else if (code.includes("typescript")) return "ts";
            else if (code.includes("ts")) return "ts";
            else if (code.includes("tsx")) return "tsx";
            else if (!fromObserver) {
                // if the codeblock doesn't have a language specified, add a mutation observer to check if the class changes and then update the languages
                const observer = new MutationObserver(mutations => {
                    mutations.forEach(mutation => {
                        if (mutation.type === "attributes" && mutation.attributeName === "class") {
                            if (mutation.target) {
                                const target = mutation.target as HTMLElement;
                                const lang = getCodeblockLanguage(target, true); // let the function know it's from the observer so it doesn't create another observer
                                if (lang) {
                                    setLanguageForId(target.id, lang);
                                    observer.disconnect();
                                }
                            }
                        }
                    });
                });

                observer.observe(codeblock, { attributes: true, attributeFilter: ["class"] });
                return null;
            }
        }
    };

    // this only checks if this particular codeblock is applied by finding if the style tag exists and has the same id as the codeblock
    const isCssCodeblockApplied = (id: string) => {
        id += "-style";
        const styleTag = document.getElementById(id);
        return styleTag !== null && styleTag.tagName === "STYLE";
    };

    const isCssCodeblockChanged = (id: string, code: string) => {
        id += "-style";
        const styleTag = document.getElementById(id);
        if (styleTag) {
            const existingStyle = styleTag.textContent;
            return code !== existingStyle;
        }
        return false;
    };

    const isCssCodeblockInQuickCss = (id: string) => {
        const quickCssId = `/*start ${id} */`;
        const quickCssEnd = `/*end ${id} */`;
        const quickCss = getQuickCssStr();
        return quickCss.includes(quickCssId) && quickCss.includes(quickCssEnd) && quickCss.indexOf(quickCssId) < quickCss.indexOf(quickCssEnd);
    };

    const getImportsAndCodeFromCssCodeblock = (code: string): { imports: string, code: string } => {
        // we need to split out the import lines from the css code
        let newImports = "";
        let newCode = "";

        // split the code by lines, if it starts with @import, add it to newImports, otherwise add it to newCode
        // if the line after an import is a blank line, remove it
        let lastLineWasImport = false;
        for (const line of code.split("\n")) {
            if (line.trim().startsWith("@import")) {
                newImports += line + "\n";
                lastLineWasImport = true;
            } else if (line.trim() === "" && lastLineWasImport) {
                // i guess we can just continue to ignore blank lines after imports (until it turns out to be a bad decision)
            } else {
                newCode += line + "\n";
                lastLineWasImport = false;
            }
        }

        return { imports: newImports.trim(), code: newCode.trim() };
    };

    const isCssCodeblockQuickCssChanged = (id: string, newCss: string, fromMsg: Message, fromChannel: Channel) => {
        if (!isCssCodeblockInQuickCss(id)) return false;
        const { imports: newImports, code: newCode } = getImportsAndCodeFromCssCodeblock(newCss);
        newCss = newImports === "" ? newCode : newImports + "\n" + newCode;

        // we need to collect all blocks of imports and regular css from the QuickCSS file and determine if the provided css is different
        const existingCss = getQuickCssStr();
        let existingImports = "";
        let existingCode = "";


        const quickCssId = `/*start ${id} */`;
        const fromId = `/* from https://discord.com/channels/${fromChannel.guild_id ?? "@me"}/${fromChannel.id}/${fromMsg.id} */`;
        const quickCssEnd = `/*end ${id} */`;

        const importsPattern = new RegExp(escapeRegExp(quickCssId) + ".*?@import[\\s]+.*?" + escapeRegExp(quickCssEnd), "si");
        const codePattern = new RegExp(escapeRegExp(quickCssId) + "(?![\\s\\S]*@import)[\\s\\S]*?" + escapeRegExp(quickCssEnd), "si");

        const importsGroups = existingCss.match(importsPattern);
        const codeGroups = existingCss.match(codePattern);

        if (importsGroups) {
            importsGroups.forEach(group => {
                existingImports += group + "\n";
            });
        }

        if (codeGroups) {
            codeGroups.forEach(group => {
                existingCode += group + "\n";
            });
        }

        // strip the quickCssId and quickCssEnd from the strings, and fromId if present
        existingImports = existingImports.replace(quickCssId, "").replace(quickCssEnd, "").replace(fromId, "").trim();
        existingCode = existingCode.replace(quickCssId, "").replace(quickCssEnd, "").replace(fromId, "").trim();

        let existing = existingImports.trim() + "\n" + existingCode.trim();

        // replace \r\n with \n for comparison
        newCss = newCss.replace(/\r\n/g, "\n");
        existing = existing.replace(/\r\n/g, "\n");

        return newCss.trim() !== existing.trim();
    };

    const applyCssCodeblock = (id: string, code: string) => {
        id += "-style";
        let style = document.getElementById(id);
        if (!style) {
            style = document.createElement("style");
            style.id = id;
            document.head.appendChild(style);
        }
        style.textContent = code;
        setCssAppliedForId(id, true);
        setCssChangedForId(id, false);
    };

    const removeCssCodeblock = (id: string) => {
        id += "-style";
        const style = document.getElementById(id);
        if (style) style.remove();
        setCssAppliedForId(id, false);
        setCssChangedForId(id, false);
    };

    const addCssCodeblockToQuickCss = (id: string, code: string, fromMsg: Message, fromChannel: Channel) => {
        const quickCssId = `/*start ${id} */`;
        const quickCssEnd = `/*end ${id} */`;
        const fromId = `/* from https://discord.com/channels/${fromChannel.guild_id ?? "@me"}/${fromChannel.id}/${fromMsg.id} */`;

        let { imports: newImports, code: newCode } = getImportsAndCodeFromCssCodeblock(code);

        if (newImports === "" && newCode === "") return;

        if (newImports !== "") newImports = quickCssId + "\n" + fromId + "\n" + newImports + "\n" + quickCssEnd;
        if (newCode !== "") newCode = quickCssId + "\n" + fromId + "\n" + newCode + "\n" + quickCssEnd;

        let existingCss = getQuickCssStr();

        // if the codeblock is already in the QuickCSS, we need to check if the css has changed
        if (isCssCodeblockInQuickCss(id)) {
            if (isCssCodeblockQuickCssChanged(id, code, fromMsg, fromChannel)) {
                // replace the imports in the position they're already in (if there's more than one import block, we replace the first and discard the rest)
                // replace the css in the position it's already in, same as above
                let firstImportStart = -1;
                let firstCodeStart = -1;

                const importsPattern = new RegExp(escapeRegExp(quickCssId) + ".*?@import[\\s]+.*?" + escapeRegExp(quickCssEnd), "si");
                const codePattern = new RegExp(escapeRegExp(quickCssId) + "(?![\\s\\S]*@import)[\\s\\S]*?" + escapeRegExp(quickCssEnd), "si");

                // find the first position of the previous version of the imports (if any)
                const importsGroups = existingCss.match(importsPattern);

                if (importsGroups) {
                    firstImportStart = existingCss.indexOf(importsGroups[0]);
                    for (const group of importsGroups) {
                        existingCss = existingCss.replace(group, "");
                    }
                }

                // insert the new imports at the first position of the previous imports
                if (newImports !== "") existingCss = existingCss.slice(0, firstImportStart) + newImports.trim() + existingCss.slice(firstImportStart);

                const codeGroups = existingCss.match(codePattern);

                if (codeGroups) {
                    firstCodeStart = existingCss.indexOf(codeGroups[0]);
                    for (const group of codeGroups) {
                        existingCss = existingCss.replace(group, "");
                    }
                }

                // insert the new code at the first position of the previous code
                if (newCode !== "") existingCss = existingCss.slice(0, firstCodeStart) + newCode.trim() + existingCss.slice(firstCodeStart);
            } else {
                // if the css hasn't changed, we shouldn't be here in the first place
                console.log("CSS hasn't changed");
                rerender(componentId);
                return;
            }
        } else {
            // if the codeblock isn't in the QuickCSS, we need to add it
            // if there are imports, we add the imports at the top of the file and the css at the bottom
            // add two newlines after the import and before the css (unless they're next to each other I guess, then just one set of two)
            if (existingCss.trim() === "") existingCss = newImports.trim() + "\n\n" + newCode.trim();
            else existingCss = newImports.trim() + "\n\n" + existingCss.trim() + "\n\n" + newCode.trim();
        }
        setQuickCssContents(existingCss.trim());
        VencordNative.quickCss.set(existingCss.trim()).then(() => {
            VencordNative.quickCss.reloadEditorCss();
            rerender(componentId);
        });
    };

    const removeCssCodeblockFromQuickCss = (id: string) => {
        const importsPattern = new RegExp("\\s*" + escapeRegExp(`/*start ${id} */`) + ".*?@import[\\s]+.*?" + escapeRegExp(`/*end ${id} */`) + "\\s*", "si");
        const codePattern = new RegExp("\\s*" + escapeRegExp(`/*start ${id} */`) + "(?![\\s\\S]*@import)[\\s\\S]*?" + escapeRegExp(`/*end ${id} */`) + "\\s*", "si");

        const existingCss = getQuickCssStr();
        const importsGroups = existingCss.match(importsPattern);
        const codeGroups = existingCss.match(codePattern);

        let newCss = existingCss;

        if (importsGroups) {
            importsGroups.forEach(group => {
                newCss = newCss.replace(group, "\n\n");
            });
        }

        if (codeGroups) {
            codeGroups.forEach(group => {
                newCss = newCss.replace(group, "\n\n");
            });
        }

        setQuickCssContents(newCss.trim());
        VencordNative.quickCss.set(newCss.trim()).then(() => {
            VencordNative.quickCss.reloadEditorCss();
            rerender(componentId);
        });
    };

    const runJavascriptCodeblock = (id: string, code: string) => {

        // warn the user that the code they're about to run is irreversible
        // todo de-dupe the bit that actually runs the code
        if (settings.store.showCodeWarning) {
            Alerts.show({
                title: "Warning",
                body: "Running code from a message can be dangerous and irreversible. Are you sure you want to run this code?",
                confirmText: "Yes", secondaryConfirmText: "Yes and don't warn again", cancelText: "No",

                onConfirm: () => {
                    const script = document.createElement("script");
                    script.textContent = code;
                    document.head.appendChild(script);
                    script.remove();
                    let closed = false;
                    showNotice("Codeblock executed", "Okay", () => {
                        popNotice();
                        closed = true;
                    });

                    setTimeout(() => {
                        if (!closed) popNotice();
                    }, 3000);
                },

                onConfirmSecondary() {
                    settings.store.showCodeWarning = false;
                    const script = document.createElement("script");
                    script.textContent = code;
                    document.head.appendChild(script);
                    script.remove();
                    let closed = false;
                    showNotice("Codeblock executed", "Okay", () => {
                        popNotice();
                        closed = true;
                    });

                    setTimeout(() => {
                        if (!closed) popNotice();
                    }, 3000);
                }
            });
        } else {
            const script = document.createElement("script");
            script.textContent = code;
            document.head.appendChild(script);
            script.remove();
            let closed = false;
            showNotice("Codeblock executed", "Okay", () => {
                popNotice();
                closed = true;
            });

            setTimeout(() => {
                if (!closed) popNotice();
            }, 3000);
        }
    };

    const isHtmlCodeblockOpenInline = (id: string): boolean => {
        const iframeC = iframeRefs.current.get(id);
        return iframeC !== undefined && iframeC.style.display === "block";
    };

    const openHtmlCodeblockInline = (id: string, code: string) => {
        const iframeC = iframeRefs.current.get(id);
        if (!iframeC) {
            console.log("iframe not found - id:", id);
            return;
        }

        if (!code) return;

        const blob = new Blob([code], { type: "text/html" });
        iframeC.src = URL.createObjectURL(blob);
        if (settings.store.iframeOptions) {
            iframeC.setAttribute("sandbox", settings.store.iframeOptions.join(" "));
        } else {
            iframeC.setAttribute("sandbox", ""); // setting it to empty means nothing allowed
        }
        iframeC.style.setProperty("display", "block", "important");
        iframeC.style.setProperty("width", "40%", "important");
        iframeC.style.setProperty("aspect-ratio", "16/9", "important");
        setIsOpenInlineForId(id, true);
    };

    const closeHtmlCodeblockInline = (id: string) => {
        const iframeC = iframeRefs.current.get(id);
        if (!iframeC) {
            console.log("iframe not found - id:", id);
            return;
        }
        iframeC.style.setProperty("display", "none", "important");
        iframeC.src = "";
        setIsOpenInlineForId(id, false);
    };

    const openHtmlCodeblockInModal = (id: string, code: string) => {
        if (!code) return;

        const blob = new Blob([code], { type: "text/html" });
        const url = URL.createObjectURL(blob);

        const modalId = "modal-" + id;

        Vencord.Util.openModal(modalProps => {
            let sandbox = "";
            if (settings.store.iframeOptions) {
                sandbox = settings.store.iframeOptions.join(" ");
            }
            return <ModalRoot
                {...modalProps}
                size={ModalSize.DYNAMIC}
            >
                <ModalHeader></ModalHeader>
                <ModalContent
                    style={{
                        display: "block",
                        width: "50vw",
                        height: "50vh",
                        paddingTop: "16",
                        paddingBottom: "16",
                        paddingLeft: "16",
                        paddingRight: "16"
                    }}
                >
                    <iframe src={url} style={{
                        backgroundColor: "white",
                        display: "block",
                        width: "100%",
                        height: "100%",
                        border: "none",
                        left: "0",
                        top: "0"
                    }}
                            sandbox={sandbox}
                    />
                </ModalContent>
                <ModalFooter>
                    <ModalCloseButton onClick={() => {
                        Vencord.Util.closeModal(modalId);
                    }}/>
                </ModalFooter>
            </ModalRoot>;
        }, { modalKey: modalId });
    };

    const componentId = useRef<string>(`component-${message.id}-${Math.random().toString(36).substr(2, 9)}`).current;

    rerender = (id: string) => {
        if (id === componentId) {
            setRerenderTrigger(prev => prev + 1);
        }
    };

    VencordNative.quickCss.addChangeListener(_ => {
        rerender(componentId);
    });

    useEffect(() => {
        try { // better safe than sorry
            const isThreadStart = message.id === channel.id;

            let chatMessage;
            if (isThreadStart) {
                chatMessage = document.querySelector("div[class*='quotedChatMessage_']")?.querySelector("div[id*='chat-messages-" + message.id + "-']");
            } else {
                chatMessage = document.querySelector(`li[id*="chat-messages-${message.channel_id}-${message.id}"]`);
            }

            if (chatMessage) {
                // get all codeblocks
                let codeBlocks = chatMessage.querySelectorAll("[class*='codeContainer_']");
                if (codeBlocks.length === 0) codeBlocks = chatMessage.querySelectorAll("[class*='shiki-container']");
                // for each codeblock, check if the <code> element has a class of html, js or css
                // if it does, add a button to run the code
                if (codeBlocks.length === 0) return;

                for (let i = 0; i < codeBlocks.length; i++) {
                    const blockId = message.id + "-" + i;
                    const codeContainer = codeBlocks[i].querySelector("code");
                    if (codeContainer) {
                        const lang = getCodeblockLanguage(codeContainer);

                        if (!lang) {
                            continue;
                        }

                        const buttonStyleGreen = {
                            backgroundColor: "var(--button-positive-background)",
                            color: "var(--text-normal)",
                            border: "none",
                            padding: "0.25rem",
                            margin: "0.25rem",
                            cursor: "pointer",
                            borderRadius: "5px"
                        };

                        const buttonStyleRed = {
                            backgroundColor: "var(--button-danger-background)",
                            color: "var(--text-normal)",
                            border: "none",
                            padding: "0.25rem",
                            margin: "0.25rem",
                            cursor: "pointer",
                            borderRadius: "5px"
                        };

                        const buttonStyleOrange = {
                            backgroundColor: "orange",
                            color: "var(--text-normal)",
                            border: "none",
                            padding: "0.25rem",
                            margin: "0.25rem",
                            cursor: "pointer",
                            borderRadius: "5px"
                        };

                        const buttonId = message.id + "-" + i;

                        if (lang === "css" || lang === "less") {
                            setCssAppliedForId(buttonId, isCssCodeblockApplied(buttonId));
                            setCssChangedForId(buttonId, isCssCodeblockChanged(buttonId, getCodeblockCode(codeContainer)));
                            setQuickCssAddedForId(buttonId, isCssCodeblockInQuickCss(buttonId));
                            setQuickCssChangedForId(buttonId, isCssCodeblockQuickCssChanged(buttonId, getCodeblockCode(codeContainer), message, channel));

                            // create the buttons and add them to a portal, which will be displayed below the codeblock
                            const cssReact = <>
                                {getCssAppliedForId(buttonId) ?
                                    <button id={buttonId} style={buttonStyleRed}
                                            onClick={() => removeCssCodeblock(buttonId)}>
                                        Remove temp {lang.toUpperCase()}
                                    </button>
                                    :
                                    <button id={buttonId} style={buttonStyleGreen}
                                            onClick={() => applyCssCodeblock(buttonId, getCodeblockCode(codeContainer))}>
                                        Apply temp {lang.toUpperCase()} // lowercase looked a bit too casual
                                    </button>}
                                {getCssChangedForId(buttonId) ?
                                    <button id={buttonId} style={buttonStyleOrange}
                                            onClick={() => applyCssCodeblock(buttonId, getCodeblockCode(codeContainer))}>
                                        Reapply temp {lang.toUpperCase()}
                                    </button> : null}
                                {getQuickCssAddedForId(buttonId) ?
                                    <button id={buttonId} style={buttonStyleRed}
                                            onClick={() => removeCssCodeblockFromQuickCss(buttonId)}>
                                        Remove from QuickCSS
                                    </button>
                                    :
                                    <button id={buttonId} style={buttonStyleGreen}
                                            onClick={() => addCssCodeblockToQuickCss(buttonId, getCodeblockCode(codeContainer), message, channel)}>
                                        Add to QuickCSS
                                    </button>}
                                {getQuickCssChangedForId(buttonId) ?
                                    <button id={buttonId} style={buttonStyleOrange}
                                            onClick={() => addCssCodeblockToQuickCss(buttonId, getCodeblockCode(codeContainer), message, channel)}>
                                        Update QuickCSS
                                    </button> : null}
                            </>;
                            addPortal(blockId, cssReact, codeBlocks[i]);
                        } else if (lang.includes("html")) {
                            setIsOpenInlineForId(blockId, isHtmlCodeblockOpenInline(blockId));

                            const htmlReact = <>
                                <button id={buttonId} style={buttonStyleGreen}
                                        onClick={() => openHtmlCodeblockInModal(blockId, getCodeblockCode(codeContainer))}>
                                    Open in popup
                                </button>
                                {getIsOpenInlineForId(blockId) ?
                                    <button id={buttonId} style={buttonStyleRed}
                                            onClick={() => closeHtmlCodeblockInline(blockId)}>
                                        Close inline
                                    </button>
                                    :
                                    <button id={buttonId} style={buttonStyleGreen}
                                            onClick={() => openHtmlCodeblockInline(blockId, getCodeblockCode(codeContainer))}>
                                        Open inline
                                    </button>}
                                {// should make it so the iframe is below the code container if it's a shiki block, rather than in the buttons div
                                    isShikiCodeblock(codeContainer) ?
                                        ReactDOM.createPortal(<iframe ref={ref => addIframeRef(blockId, ref)}
                                                                      id={buttonId + "-iframe"}
                                                                      style={{
                                                                          backgroundColor: "white",
                                                                          display: "none",
                                                                          border: "none"
                                                                      }}
                                        />, codeContainer)
                                        :
                                        <iframe ref={ref => addIframeRef(blockId, ref)}
                                                id={buttonId + "-iframe"}
                                                style={{ backgroundColor: "white", display: "none", border: "none" }}
                                        />
                                }

                            </>;
                            addPortal(blockId, htmlReact, codeBlocks[i]);
                        } else if (lang === "js" || lang === "javascript") {
                            const jsReact = <>
                                <button id={buttonId} style={buttonStyleGreen}
                                        onClick={() => runJavascriptCodeblock(blockId, getCodeblockCode(codeContainer))}>
                                    Run JS
                                </button>
                            </>;
                            addPortal(blockId, jsReact, codeBlocks[i]);
                        } else {
                            if(window.ecDebug) console.log("Unsupported language", lang);
                        }

                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }, [message, rerenderer, quickCssContents, _isCssApplied, _isCssChanged, _isInQuickCss, _isQuickCssChanged, _isOpenInline, _languages]);

    return <>{Array.from(_portals.values())}</>;
}
