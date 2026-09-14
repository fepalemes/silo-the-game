// Debug viewpoints. Open the game with `?view=<name>&hud=0` to drop the
// camera at a fixed spot with the interface hidden - used to grab reference
// screenshots of each part of the silo without having to fly there by hand.
// See README ("Conferindo o visual").
import { WING_OFFSETS, WORLD } from "./config.js";

// Our forward vector is (-sin(yaw), -cos(yaw)), so this is the yaw that
// points the camera from one XZ point at another.
function yawToward(fromX, fromZ, toX, toZ) {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

const at = (r, theta, y) => ({ x: r * Math.cos(theta), z: r * Math.sin(theta), y });

export const VIEWPOINT_NAMES = ["hub", "shaft", "down", "up", "ring", "bridge", "room", "cafeteria", "entrada", "stairs", "deep", "void"];

export function getViewpoint(name, layout) {
  const EYE = WORLD.eyeHeight;
  const s0 = layout.stations[0];
  // Pick deep viewpoints by level id, not by array index: with all 148 levels
  // built, index 10 is level 11 - near the top, not deep.
  const byId = (id) => layout.stations.find((st) => st.id === id) || layout.stations[layout.stations.length - 1];
  const deep = byId("mecanica");

  switch (name) {
    // Standing on the hub looking out across the void, the way the game starts.
    case "hub": {
      const p = at(5, 0, s0.y + EYE);
      return { ...p, theta: 0, yaw: yawToward(p.x, p.z, 20, 0), pitch: -0.05 };
    }
    // Same spot, turned around to look back across the shaft.
    case "shaft": {
      const p = at(6.2, 0.9, s0.y + EYE);
      return { ...p, theta: 0.9, yaw: yawToward(p.x, p.z, 0, 0), pitch: 0.05 };
    }
    // Over the stairwell, looking straight down the helix.
    case "down": {
      const p = at(2.6, 0.2, s0.y + EYE);
      return { ...p, theta: 0.2, yaw: yawToward(p.x, p.z, 0, 0), pitch: -1.15 };
    }
    case "up": {
      const p = at(2.6, 0.2, deep.y + EYE);
      return { ...p, theta: 0.2, yaw: yawToward(p.x, p.z, 0, 0), pitch: 1.1 };
    }
    // On the ring, looking along the hall.
    case "ring": {
      const theta = 0.9;
      const p = at(19.5, theta, s0.y + EYE);
      const ahead = theta + 0.5;
      return { ...p, theta, yaw: yawToward(p.x, p.z, 19.5 * Math.cos(ahead), 19.5 * Math.sin(ahead)), pitch: -0.02 };
    }
    // Halfway across the landing deck - the one crossing of the void, where
    // the stair meets a level's ring. (The old per-wing bridges are gone.)
    case "bridge": {
      const p = at((WORLD.hubR + WORLD.ringInnerR) / 2, 0, s0.y + EYE);
      return { ...p, theta: 0, yaw: yawToward(p.x, p.z, 40, 0), pitch: -0.02 };
    }
    // Inside the main themed room of the top floor. Its bearing follows the
    // level's wing rotation now that wings can sit anywhere around the ring.
    case "room": {
      const a = (s0.wingRotation || 0) + WING_OFFSETS[0];
      const r = WORLD.landingR + WORLD.corridorLen + 4;
      const p = at(r, a, s0.y + EYE);
      return { ...p, theta: a, yaw: yawToward(p.x, p.z, 60 * Math.cos(a), 60 * Math.sin(a)), pitch: 0 };
    }
    // At the cafeteria entrance, beside the console: a human-height view
    // showing the tables, fittings and screen together.
    case "cafeteria": {
      const a = (s0.wingRotation || 0) + WING_OFFSETS[0];
      const x = WORLD.landingR + WORLD.corridorLen + 1, z = -1.3;
      const p = { x: x * Math.cos(a) - z * Math.sin(a), z: x * Math.sin(a) + z * Math.cos(a), y: EYE };
      const target = WORLD.landingR + WORLD.corridorLen + s0.roomDepth - 1;
      return { ...p, theta: a, yaw: yawToward(p.x, p.z, target * Math.cos(a), target * Math.sin(a)), pitch: -0.04 };
    }
    case "entrada": {
      const a=(s0.wingRotation || 0)+WING_OFFSETS[0];
      const p=at(20.2,a,s0.y+EYE);
      return {...p,theta:a,yaw:yawToward(p.x,p.z,32*Math.cos(a),32*Math.sin(a)),pitch:.02};
    }
    // Partway down the first flight of stairs.
    case "stairs": {
      const slope = layout.slopes[0];
      const t = 0.12;
      const theta = slope.thetaStart + (slope.thetaEnd - slope.thetaStart) * t;
      const y = slope.yStart + (slope.yEnd - slope.yStart) * t;
      const p = at(4.4, theta, y + EYE);
      const ahead = theta + 0.6;
      return { ...p, theta, yaw: yawToward(p.x, p.z, 4.4 * Math.cos(ahead), 4.4 * Math.sin(ahead)), pitch: -0.25 };
    }
    // A deep, warm-palette floor for checking the colour gradient.
    case "deep": {
      const p = at(5, deep.theta, deep.y + EYE);
      return { ...p, theta: deep.theta, yaw: yawToward(p.x, p.z, 40 * Math.cos(deep.theta), 40 * Math.sin(deep.theta)), pitch: -0.05 };
    }
    // Floating in the void to judge the stacked decorative levels.
    case "void": {
      const p = at(11, 0.4, s0.y - 9);
      return { ...p, theta: 0.4, yaw: yawToward(p.x, p.z, 0, 0), pitch: -0.55 };
    }
    default:
      return null;
  }
}
