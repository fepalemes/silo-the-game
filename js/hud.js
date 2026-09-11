import { zoneForLevel } from "./config.js";
import { clamp, lerp } from "./mathutils.js";

export function initHud() {
  const el = {
    start: document.getElementById("start-screen"),
    pause: document.getElementById("pause-screen"),
    hud: document.getElementById("hud"),
    levelName: document.getElementById("level-name"),
    levelSub: document.getElementById("level-sub"),
    levelNumber: document.getElementById("level-number"),
    depthMarker: document.getElementById("depth-marker"),
    interactPrompt: document.getElementById("interact-prompt"),
    lorePanel: document.getElementById("lore-panel"),
    loreTitle: document.getElementById("lore-title"),
    loreBody: document.getElementById("lore-body"),
  };

  function showStart(onStart) {
    el.start.hidden = false;
    el.start.addEventListener(
      "click",
      function handler() {
        el.start.removeEventListener("click", handler);
        onStart();
      },
      { once: true }
    );
  }

  function hideStart() {
    el.start.hidden = true;
  }

  function setPaused(paused) {
    el.pause.hidden = !paused;
  }

  function setLocation(info) {
    if (info.fromStation && info.toStation) {
      const lvl = Math.round(lerp(info.fromStation.level, info.toStation.level, info.progress));
      el.levelName.textContent = "ESCADARIA";
      el.levelSub.textContent = `Entre ${info.fromStation.name} e ${info.toStation.name}`;
      el.levelNumber.textContent = `NÍVEL ${lvl} · ${zoneForLevel(lvl).name}`;
    } else {
      el.levelName.textContent = info.station.name;
      el.levelSub.textContent = info.station.subtitle;
      el.levelNumber.textContent = info.station.isSublevel
        ? `ABAIXO DO NÍVEL ${info.station.level}`
        : `NÍVEL ${info.station.level} · ${zoneForLevel(info.station.level).name}`;
    }
  }

  function setDepth(fraction) {
    el.depthMarker.style.top = `${clamp(fraction, 0, 1) * 100}%`;
  }

  function setInteractVisible(visible) {
    el.interactPrompt.hidden = !visible;
  }

  function showLore(station) {
    el.loreTitle.textContent = `${station.name} · NÍVEL ${station.level}`;
    el.loreBody.textContent = station.lore.join("  ");
    el.lorePanel.hidden = false;
  }

  function hideLore() {
    el.lorePanel.hidden = true;
  }

  function isLoreOpen() {
    return !el.lorePanel.hidden;
  }

  return {
    showStart,
    hideStart,
    setPaused,
    setLocation,
    setDepth,
    setInteractVisible,
    showLore,
    hideLore,
    isLoreOpen,
  };
}
