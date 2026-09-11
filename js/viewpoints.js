// Debug viewpoints. Open the game with `?view=<name>&hud=0` to drop the
// camera at a fixed spot with the interface hidden - used to grab reference
// screenshots of each part of the silo without having to fly there by hand.
// See README ("Conferindo o visual").
import { WORLD } from "./config.js";

// Our forward vector is (-sin(yaw), -cos(yaw)), so this is the yaw that
// points the camera from one XZ point at another.
function yawToward(fromX, fromZ, toX, toZ) {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

const at = (r, theta, y) => ({ x: r * Math.cos(theta), z: r * Math.sin(theta), y });

export const VIEWPOINT_NAMES = ["hub", "shaft", "down", "up", "ring", "bridge", "room", "stairs", "deep", "void"];

export function getViewpoint(name, layout) {
  const EYE = WORLD.eyeHeight;
  const s0 = layout.stations[0];
  const deep = layout.stations[Math.min(10, layout.stations.length - 1)];

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
    // Halfway across a bridge, facing the ring doorway.
    case "bridge": {
      const p = at((WORLD.hubR + WORLD.ringInnerR) / 2, 0, s0.y + EYE);
      return { ...p, theta: 0, yaw: yawToward(p.x, p.z, 40, 0), pitch: -0.02 };
    }
    // Inside the main themed room of the top floor.
    case "room": {
      const p = at(WORLD.landingR + WORLD.corridorLen + 4, 0, s0.y + EYE);
      return { ...p, theta: 0, yaw: yawToward(p.x, p.z, 60, 0), pitch: 0 };
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
