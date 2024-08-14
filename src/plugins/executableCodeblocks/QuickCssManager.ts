/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

class QuickCssManager {
    private static instance: QuickCssManager;
    private quickCssContents: string = "";
    private initialSetup: boolean = false;

    private constructor() {}

    public static getInstance(): QuickCssManager {
        if (!QuickCssManager.instance) {
            QuickCssManager.instance = new QuickCssManager();
            VencordNative.quickCss.addChangeListener((newCss: string) => {
                QuickCssManager.instance.setQuickCssContents(newCss);
            });
        }
        return QuickCssManager.instance;
    }

    public getQuickCssContents(): string {
        return this.quickCssContents;
    }

    public setQuickCssContents(contents: string): void {
        if (!this.initialSetup) this.initialSetup = true;
        this.quickCssContents = contents;
    }

    public isSetUp(): boolean {
        return this.initialSetup;
    }
}

export default QuickCssManager;
