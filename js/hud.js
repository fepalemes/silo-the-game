import { zoneForLevel } from "./config.js";
import { clamp, lerp } from "./mathutils.js";

// The three lines that say where the player is. Shared with the headset HUD
// (js/xr/hud.js), which has to draw the same thing without the DOM.
export function levelLabels(info) {
  const station = info.station;
  const stair = Boolean(info.fromStation);
  const lvl = stair ? Math.round(lerp(info.fromStation.level, info.toStation.level, info.progress)) : station.level;
  return {
    key: `${stair}:${lvl}:${station.id}`,
    name: stair ? "ESCADARIA CENTRAL" : station.name,
    sub: stair ? `Nível ${info.fromStation.level} ↔ ${info.toStation.level}` : station.subtitle,
    number: station.isSublevel ? `SUBSOLO ${lvl - 144} · ABAIXO DO 144` : `NÍVEL ${String(lvl).padStart(3, "0")} / 144 · ${zoneForLevel(lvl).name}`,
  };
}

export function initHud() {
  const el = Object.fromEntries(["start-screen", "pause-screen", "hud", "level-name", "level-sub", "level-number", "depth-marker", "interact-prompt", "lore-panel", "lore-title", "lore-body", "start-button", "status"].map((id) => [id, document.getElementById(id)]));
  let lastLocation = "", lastDepth = "";
  function showStart(onStart) {
    el["start-screen"].hidden = false;
    el["start-button"].disabled = false;
    el["start-button"].textContent = "Entrar no Silo →";
    el["status"].textContent = "Exploração em primeira pessoa · Fones recomendados";
    el["start-button"].addEventListener("click", onStart);
  }
  function hideStart() {
    el["start-screen"].hidden = true;
    el.hud.hidden = false;
  }
  function setPaused(paused) {
    el["pause-screen"].hidden = !paused;
    el.hud.hidden = paused;
    if (paused) document.getElementById("resume-button").focus();
  }
  function setLocation(info) {
    const labels = levelLabels(info);
    if (labels.key === lastLocation) return null;
    lastLocation = labels.key;
    el["level-name"].textContent = labels.name;
    el["level-sub"].textContent = labels.sub;
    el["level-number"].textContent = labels.number;
    return labels;
  }
  function setDepth(fraction) {
    const depth = `${(clamp(fraction, 0, 1) * 100).toFixed(2)}%`;
    if (depth !== lastDepth) el["depth-marker"].style.top = depth;
    lastDepth = depth;
  }
  function showText(title, lines) {
    el["lore-title"].textContent = title;
    el["lore-body"].replaceChildren(...lines.map((text) => {
      const p = document.createElement("p"); p.textContent = text; return p;
    }));
    el["lore-panel"].hidden = false;
  }
  const showLore = (station) => showText(`${station.name} · NÍVEL ${station.level}`, station.lore);
  return { showStart, hideStart, setPaused, setLocation, setDepth, showLore, showText,
    setInteractVisible: (visible) => { el["interact-prompt"].hidden = !visible; },
    hideLore: () => { el["lore-panel"].hidden = true; },
    isLoreOpen: () => !el["lore-panel"].hidden,
    setStatus: (text) => {
      el.status.textContent = text;
      document.getElementById("pause-status").textContent = text;
    },
  };
}
