/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RendererSettings } from "@main/settings";
import { app } from "electron";

app.on("browser-window-created", (_, win) => {
    win.webContents.on("frame-created", (_, { frame }) => {
        frame?.once("dom-ready", () => {
            if (frame.url.startsWith("https://open.spotify.com/embed/")) {
                const settings = RendererSettings.store.plugins?.FixSpotifyEmbeds;
                if (!settings?.enabled) return;

                const volume = (settings.volume / 50) || 0.2;

                // AI slop ngl
                frame.executeJavaScript(
                    // language=JavaScript
                    `
                        // Use a global volume variable that can be modified by the slider
                        window.VencordSpotifyVolume = ${volume};
                        console.log("[FixSpotifyEmbeds-Frame] Script injected, setting volume to", window.VencordSpotifyVolume);

                        // Store our volume in localStorage to persist between tracks
                        try {
                            const storedVolume = localStorage.getItem("vencord-spotify-volume");
                            if (storedVolume !== null) {
                                window.VencordSpotifyVolume = parseFloat(storedVolume);
                                console.log("[FixSpotifyEmbeds-Frame] Restored volume from localStorage:", window.VencordSpotifyVolume);
                            } else {
                                localStorage.setItem("vencord-spotify-volume", window.VencordSpotifyVolume.toString());
                            }
                        } catch (e) {
                            console.error("[FixSpotifyEmbeds-Frame] Failed to access localStorage:", e);
                        }

                        // Track changes monitor
                        let currentTrackId = null;
                        function monitorTrackChanges() {
                            // Try to find track ID from various potential sources
                            const trackElem = document.querySelector("[class*='TracklistRow_isCurrentTrack_']")?.getAttribute("data-testid");

                            if (trackElem !== currentTrackId) {
                                currentTrackId = trackElem;

                                // Apply volume to all audio elements whenever track changes
                                applyVolumeToAllElements();
                            }
                        }

                        // Function to apply volume to all possible audio elements
                        function applyVolumeToAllElements() {
                            // 1. Apply to any HTML media elements
                            window.VencordSliderChanging = true;
                            document.querySelectorAll("audio, video").forEach(media => {
                                media.volume = 1; // we set the volume to 1 and then use gain to multiply it
                            });
                            window.VencordSliderChanging = false;

                            // 2. Apply to any GainNodes
                            if (window.VencordGainNodes) {
                                    window.VencordGainNodes.forEach(node => {
                                        try {
                                            if (node && node.gain) {
                                                node.gain.value = window.VencordSpotifyVolume;
                                            }
                                        } catch (e) {
                                            console.error("[FixSpotifyEmbeds-Frame] Error applying volume to GainNode:", e);
                                        }
                                    });
                            }
                        }

                        // Keep existing audio element handling but reference the global variable
                        const original = Audio.prototype.play;
                        Audio.prototype.play = function () {
                            this.volume = 1; // we set the volume to 1 and then use gain to multiply it
                            return original.apply(this, arguments);
                        };

                        if (window.AudioContext || window.webkitAudioContext) {
                            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;

                            window.VencordGainNodes = [];

                            if (AudioCtxClass.prototype.createGain) {
                                const origCreateGain = AudioCtxClass.prototype.createGain;
                                AudioCtxClass.prototype.createGain = function () {
                                        const gainNode = origCreateGain.apply(this, arguments);
                                        try {
                                            gainNode.gain.value = window.VencordSpotifyVolume;
                                            window.VencordGainNodes.push(gainNode);
                                        }catch (e) {
                                            console.error("[FixSpotifyEmbeds-Frame] Error creating GainNode:", e);
                                        }
                                        return gainNode;
                                };
                            }
                        }

                        // Add a hover-activated volume control
                        function addVolumeControl() {

                            // Find the player controls container
                            const controlsSelectorUnauthedTrack = "div[class^=PreviewPlayButton_circularContainer_]";
                            const controlsSelectorAuthedTrack = "div[class^=PlayerControls_playButtonWrapper_]";
                            const controlsSelectorUnauthedPlaylist = "div[class^=PreviewPlayButton_circularContainer_]";
                            const controlsSelectorAuthedPlaylist = "div[class^=PlayerControlsExtendedNoAnimation_playButtonWrapper_]";

                            let controlsElement = document.querySelector(controlsSelectorUnauthedTrack) ||
                                document.querySelector(controlsSelectorAuthedTrack) ||
                                document.querySelector(controlsSelectorUnauthedPlaylist) ||
                                document.querySelector(controlsSelectorAuthedPlaylist);


                            if (!controlsElement || !controlsElement.parentElement) {
                                return false;
                            }

                            // Check if our control already exists
                            if (document.getElementById("vencord-spotify-volume")) {
                                return true;
                            }

                            // Create the main container
                            const volumeContainer = document.createElement("div");
                            volumeContainer.id = "vencord-spotify-volume";
                            volumeContainer.style.position = "relative";
                            volumeContainer.style.display = "flex";
                            volumeContainer.style.alignItems = "center";

                            // Create volume icon button
                            const volumeButton = document.createElement("div");
                            volumeButton.innerHTML = "🔊";
                            volumeButton.style.fontSize = "16px";
                            volumeButton.style.display = "flex";
                            volumeButton.style.flexDirection = "column";
                            volumeButton.style.justifyContent = "flex-end";
                            volumeButton.style.height = "100%";
                            volumeButton.style.cursor = "pointer";
                            volumeButton.style.borderRadius = "50%";
                            volumeButton.style.transition = "background-color 0.2s";
                            volumeButton.title = "Adjust Volume";

                            // Create slider container (hidden by default)
                            const sliderContainer = document.createElement("div");
                            sliderContainer.style.position = "absolute";
                            sliderContainer.style.display = "none";
                            sliderContainer.style.flexDirection = "row";
                            sliderContainer.style.alignItems = "center";
                            sliderContainer.style.background = "#282828";
                            sliderContainer.style.padding = "8px 8px";
                            sliderContainer.style.borderRadius = "4px";
                            sliderContainer.style.boxShadow = "0 2px 10px rgba(0,0,0,0.3)";
                            sliderContainer.style.zIndex = "100";
                            sliderContainer.style.left = "-150px";
                            sliderContainer.style.bottom = "20px";
                            sliderContainer.style.width = "200px";

                            // Create the slider
                            const slider = document.createElement("input");
                            slider.type = "range";
                            slider.min = "0";
                            slider.max = "200";
                            slider.value = Math.round(window.VencordSpotifyVolume * 100).toString();
                            slider.style.width = "100%";
                            slider.style.accentColor = "#1db954";
                            slider.style.margin = "0 8px";

                            // Create volume percentage display
                            const volumePercentage = document.createElement("span");
                            volumePercentage.textContent = \`\${slider.value}%\`;
                            volumePercentage.style.fontSize = "12px";
                            volumePercentage.style.fontWeight = "bold";
                            volumePercentage.style.color = "#ffffff";
                            volumePercentage.style.minWidth = "36px";
                            volumePercentage.style.textAlign = "right";

                            // Add event listener for slider changes
                            slider.addEventListener("input", (e) => {
                                const newVolume = Number(slider.value) / 100;
                                volumePercentage.textContent = \`\${slider.value}%\`;

                                // Update our global volume
                                window.VencordSpotifyVolume = newVolume;

                                // Store in localStorage for persistence
                                try {
                                    localStorage.setItem("vencord-spotify-volume", newVolume.toString());
                                } catch (e) {
                                }

                                // Apply the volume to all elements
                                applyVolumeToAllElements();

                                // Update icon based on volume level
                                updateVolumeIcon(newVolume);
                            });

                            // Function to update volume icon based on volume level
                            function updateVolumeIcon(vol) {
                                if (vol === 0) {
                                    volumeButton.innerHTML = "🔇";
                                } else if (vol < 0.6) {
                                    volumeButton.innerHTML = "🔈";
                                } else if (vol < 1.4) {
                                    volumeButton.innerHTML = "🔉";
                                } else {
                                    volumeButton.innerHTML = "🔊";
                                }
                            }

                            // Initialize icon
                            updateVolumeIcon(window.VencordSpotifyVolume);

                            // Show the slider on hover
                            volumeButton.addEventListener("mouseenter", () => {
                                sliderContainer.style.display = "flex";
                            });

                            // Hide the slider when mouse leaves the entire control
                            volumeContainer.addEventListener("mouseleave", () => {
                                sliderContainer.style.display = "none";
                            });

                            // Keep slider visible when hovering over it
                            sliderContainer.addEventListener("mouseenter", () => {
                                sliderContainer.style.display = "flex";
                            });

                            // Mute/unmute on click
                            volumeButton.addEventListener("click", () => {
                                if (window.VencordSpotifyVolume > 0) {
                                    // Store current volume and mute
                                    window.VencordLastVolume = window.VencordSpotifyVolume;
                                    window.VencordSpotifyVolume = 0;
                                    slider.value = "0";
                                    volumePercentage.textContent = "0%";
                                    updateVolumeIcon(0);
                                } else {
                                    // Restore previous volume
                                    const lastVol = window.VencordLastVolume || 0.1;
                                    window.VencordSpotifyVolume = lastVol;
                                    slider.value = Math.round(lastVol * 100).toString();
                                    volumePercentage.textContent = \`\${slider.value}%\`;
                                    updateVolumeIcon(lastVol);
                                }

                                // Store in localStorage
                                try {
                                    localStorage.setItem("vencord-spotify-volume", window.VencordSpotifyVolume.toString());
                                } catch (e) {
                                    console.error("[FixSpotifyEmbeds-Frame] Failed to save volume to localStorage:", e);
                                }

                                // Apply the volume changes
                                applyVolumeToAllElements();
                            });

                            // Assemble the components
                            sliderContainer.appendChild(slider);
                            sliderContainer.appendChild(volumePercentage);
                            volumeContainer.appendChild(volumeButton);
                            volumeContainer.appendChild(sliderContainer);

                            // Insert before the controls element
                            controlsElement.parentElement.insertBefore(volumeContainer, controlsElement);
                            console.log("[FixSpotifyEmbeds-Frame] Volume control added successfully");
                            return true;
                        }

                        // Set up track change monitoring
                        setInterval(monitorTrackChanges, 1000);

                        // Monitor for audio playback events
                        document.addEventListener("play", function(e) {
                            if (e.target instanceof HTMLMediaElement) {
                                setTimeout(() => {
                                    e.target.volume = 1; // we set the volume to 1 and then use gain to multiply it
                                }, 0);
                            }
                        }, true);

                        // Set up mutation observer to catch dynamically added media elements
                        const mediaObserver = new MutationObserver((mutations) => {
                            let shouldApplyVolume = false;

                            mutations.forEach(mutation => {
                                if (mutation.addedNodes.length) {
                                    shouldApplyVolume = true;
                                }
                            });

                            if (shouldApplyVolume) {
                                setTimeout(applyVolumeToAllElements, 50);
                            }
                        });

                        mediaObserver.observe(document.body, {
                            childList: true,
                            subtree: true
                        });

                        // Try to add the volume control immediately and also with delay
                        if (!addVolumeControl()) {
                            const observer = new MutationObserver(() => {
                                if (addVolumeControl()) {
                                    observer.disconnect();
                                }
                            });

                            observer.observe(document.body, {
                                childList: true,
                                subtree: true
                            });

                            [500, 1000, 2000, 5000].forEach(ms => {
                                setTimeout(() => {
                                    if (addVolumeControl()) {
                                        observer.disconnect();
                                    }
                                }, ms);
                            });
                        }

                        // Apply volume immediately
                        applyVolumeToAllElements();
                    `
                ).then(() => {
                    console.log("[FixSpotifyEmbeds] Script injection completed");
                }).catch(err => {
                    console.error("[FixSpotifyEmbeds] Script injection failed:", err);
                });
            }
        });
    });
});
