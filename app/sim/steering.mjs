/** @typedef {{ speed: number, rudder: number, heading: number | null }} HelmCommand */
/** @typedef {{ own: HelmCommand, target: HelmCommand }} HelmCommands */

export const STEERING = {
  maxRudder: 35,
  rudderRate: 2.5, // degrees/s: 65 degrees of travel takes 26 simulated seconds.
  yawTime: 20, // illustrative first-order Nomoto response at 20 kt.
  turningRadius: 155 * 2.8, // steady hard-over radius, in metres.
};
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const normalizeHeading = angle => ((angle % 360) + 360) % 360;
export const headingError = (desired, actual) => ((desired - actual + 540) % 360 + 360) % 360 - 180;

/** @returns {HelmCommands} */
export function defaultHelmCommands() {
  return { own: { speed: 20, rudder: 0, heading: null }, target: { speed: 20, rudder: 0, heading: null } };
}

/** A heading order drives the rudder, never the vessel's heading directly. */
export function rudderOrder(boat, command) {
  if (typeof command.heading !== "number" || !Number.isFinite(command.heading)) {
    return clamp(command.rudder, -STEERING.maxRudder, STEERING.maxRudder);
  }
  const error = headingError(normalizeHeading(command.heading), boat.heading);
  const rate = boat.yawRate ?? 0;
  if (Math.abs(error) < 0.15 && Math.abs(rate) < 0.01) return 0;
  // Rate feedback applies counter-rudder before reaching the ordered heading.
  return clamp(error * 2.2 - rate * 42, -STEERING.maxRudder, STEERING.maxRudder);
}

/** Shared by live motion and displayed predictions. Parameters are training
 * approximations for this hull, not measured manoeuvring coefficients.
 * First-order Nomoto yaw response: T dr/dt + r = K delta.
 */
export function steeringStep(boat, command, dt) {
  const speedOrder = clamp(command.speed, 0, 30);
  const speed = boat.speed + (speedOrder - boat.speed) * (1 - Math.exp(-dt / (speedOrder > boat.speed ? 35 : 55)));
  const order = rudderOrder(boat, command);
  const rudder = boat.rudder + clamp(order - boat.rudder, -STEERING.rudderRate * dt, STEERING.rudderRate * dt);
  const steadyRate = rudder / STEERING.maxRudder * (speed * 1852 / 3600) / STEERING.turningRadius * 180 / Math.PI;
  const timeConstant = STEERING.yawTime * 20 / Math.max(speed, 4);
  const decay = Math.exp(-dt / timeConstant);
  const previousRate = boat.yawRate ?? 0;
  const yawRate = steadyRate + (previousRate - steadyRate) * decay;
  const turn = steadyRate * dt + (previousRate - steadyRate) * timeConstant * (1 - decay);
  const heading = normalizeHeading(boat.heading + turn);
  const midHeading = (boat.heading + turn / 2) * Math.PI / 180;
  return { ...boat, speed, rudder, yawRate, heading,
    x: boat.x + Math.sin(midHeading) * speed * 1852 / 3600 * dt,
    y: boat.y + Math.cos(midHeading) * speed * 1852 / 3600 * dt,
  };
}
