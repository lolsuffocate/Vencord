/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const listeners = new Map<string, HeadersReceivedListener>();

// add a listener for headers. If no ID is provided, a random one will be generated and returned for later removal
export function addHeadersReceivedListener(listener: HeadersReceivedListener, id?: string) {
    if(id === undefined) {
        id = Math.random().toString(36).substring(12);
    }
    listeners.set(id, listener);
    return id;
}

// remove a listener by ID or listener function
export function removeHeadersReceivedListener(idOrListener: string | HeadersReceivedListener) {
    if (typeof idOrListener === "string") {
        listeners.delete(idOrListener);
    } else {
        for (const [id, listener] of listeners.entries()) {
            if (listener === idOrListener) {
                listeners.delete(id);
                break;
            }
        }
    }
}

export function emitHeadersReceived(details: Electron.OnHeadersReceivedListenerDetails) {
    if (!listeners || listeners.size === 0) return;
    for (const listener of listeners.values()) {
        try {
            listener(details);
        }catch(e) {
            console.error("Uncaught exception in headers received listener", listener, e);
        }
    }
}

export type HeadersReceivedListener = (details: Electron.OnHeadersReceivedListenerDetails) => void;
