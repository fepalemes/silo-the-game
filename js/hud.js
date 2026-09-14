import { zoneForLevel } from "./config.js";
import { clamp, lerp } from "./mathutils.js";

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
    const station = info.station;
    const stair = Boolean(info.fromStation);
    const lvl = stair ? Math.round(lerp(info.fromStation.level, info.toStation.level, info.progress)) : station.level;
    const key = `${stair}:${lvl}:${station.id}`;
    if (key === lastLocation) return;
    lastLocation = key;
    el["level-name"].textContent = stair ? "ESCADARIA CENTRAL" : station.name;
    el["level-sub"].textContent = stair ? `Nível ${info.fromStation.level} ↔ ${info.toStation.level}` : station.subtitle;
    el["level-number"].textContent = station.isSublevel ? `SUBSOLO ${lvl - 144} · ABAIXO DO 144` : `NÍVEL ${String(lvl).padStart(3, "0")} / 144 · ${zoneForLevel(lvl).name}`;
  }
  function setDepth(fraction) {
    const depth = `${(clamp(fraction, 0, 1) * 100).toFixed(2)}%`;
    if (depth !== lastDepth) el["depth-marker"].style.top = depth;
    lastDepth = depth;
  }
  function showLore(station) {
    el["lore-title"].textContent = `${station.name} · NÍVEL ${station.level}`;
    el["lore-body"].replaceChildren(...station.lore.map((text) => {
      const p = document.createElement("p"); p.textContent = text; return p;
    }));
    el["lore-panel"].hidden = false;
  }
  return { showStart, hideStart, setPaused, setLocation, setDepth, showLore,
    setInteractVisible: (visible) => { el["interact-prompt"].hidden = !visible; },
    hideLore: () => { el["lore-panel"].hidden = true; },
    isLoreOpen: () => !el["lore-panel"].hidden,
    setStatus: (text) => {
      el.status.textContent = text;
      document.getElementById("pause-status").textContent = text;
    },
  };
}
