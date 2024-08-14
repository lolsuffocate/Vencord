/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addHeadersReceivedListener } from "@api/HeadersReceived";
import { app } from "electron";

app.whenReady().then(() => {
    const findHeader = (headers: Record<string, string[]>, headerName: Lowercase<string>) => {
        return Object.keys(headers).find(h => h.toLowerCase() === headerName.toLowerCase());
    };

    // Remove CSP
    type PolicyResult = Record<string, string[]>;

    const parsePolicy = (policy: string): PolicyResult => {
        const result: PolicyResult = {};
        policy.split(";").forEach(directive => {
            const [directiveKey, ...directiveValue] = directive.trim().split(/\s+/g);
            if (directiveKey && !Object.prototype.hasOwnProperty.call(result, directiveKey)) {
                result[directiveKey] = directiveValue;
            }
        });

        return result;
    };
    const stringifyPolicy = (policy: PolicyResult): string =>
        Object.entries(policy)
            .filter(([, values]) => values?.length)
            .map(directive => directive.flat().join(" "))
            .join("; ");

    const patchCsp = (headers: Record<string, string[]>) => {
        const header = findHeader(headers, "content-security-policy");

        if (header) {
            const csp = parsePolicy(headers[header][0]);

            for (const directive of ["frame-src", "script-src"]) {
                csp[directive] ??= [];
                csp[directive].push("*", "blob:", "data:", "vencord:", "'unsafe-inline'", "'unsafe-eval'");

                if (directive === "script-src") {
                    for (const host of csp[directive]) {
                        // remove the nonce from the script-src directive as it prevents unsafe-inline from having any effect
                        if (host.startsWith("'nonce-")) {
                            console.log("Removing nonce", host);
                            csp[directive].splice(csp[directive].indexOf(host), 1);
                        }
                    }
                }
            }

            headers[header] = [stringifyPolicy(csp)];
        }
    };

    const headersReceivedListener = (details: Electron.OnHeadersReceivedListenerDetails) => {
        const { responseHeaders, resourceType } = details;
        if (responseHeaders) {
            if (resourceType === "mainFrame")
                patchCsp(responseHeaders);

            let header = findHeader(responseHeaders, "frame-options");
            if (header) {
                responseHeaders[header] = responseHeaders[header].filter(v => v.toLowerCase() !== "deny" && v.toLowerCase() !== "sameorigin");
                // delete responseHeaders[header];
            }
            header = findHeader(responseHeaders, "x-frame-options");
            if (header) {
                responseHeaders[header] = responseHeaders[header].filter(v => v.toLowerCase() !== "deny" && v.toLowerCase() !== "sameorigin");
                // delete responseHeaders[header];
            }
        }
    };

    addHeadersReceivedListener(headersReceivedListener, "executable-codeblocks");
});
