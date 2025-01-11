/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app } from "electron";

export async function fullRestart(_?: any) {
    const currentDir = app.getAppPath();
    app.relaunch({ execPath: currentDir.substring(0, currentDir.indexOf("app-"))+"/startnewest.bat" });
    app.exit();
}
