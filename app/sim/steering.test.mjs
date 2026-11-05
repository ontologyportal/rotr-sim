import test from "node:test";
import assert from "node:assert/strict";
import { advance, initialState, STEP } from "./model.mjs";
import { createSimulation, advanceSimulation, defaultSettings } from "./watchkeeping.mjs";
import { defaultHelmCommands, headingError, rudderOrder, steeringStep, STEERING } from "./steering.mjs";

function run(boat, command, seconds) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) boat = steeringStep(boat, command, STEP);
  return boat;
}

test("hard-over orders respect rudder travel, deflection, and finite turning radius", () => {
  let boat = initialState().own;
  for (let i = 0; i < 3600; i++) {
    const next = steeringStep(boat, { speed: 20, rudder: 90 }, STEP);
    assert.ok(Math.abs(next.rudder - boat.rudder) <= STEERING.rudderRate * STEP + 1e-9);
    assert.ok(Math.abs(next.rudder) <= 35);
    assert.ok(Math.abs(next.yawRate) <= 1.37);
    boat = next;
  }
  assert.equal(boat.rudder, 35);
  const reverse = run(boat, { speed: 20, rudder: -35 }, 26);
  assert.ok(Math.abs(reverse.rudder + 30) < 1e-6);
});

test("heading hold takes the short turn across north in both directions", () => {
  const boat = initialState().own;
  assert.ok(rudderOrder({ ...boat, heading: 350 }, { heading: 10 }) > 0);
  assert.ok(rudderOrder({ ...boat, heading: 10 }, { heading: 350 }) < 0);
  const next = steeringStep({ ...boat, heading: 350 }, { speed: 20, rudder: 0, heading: 10 }, STEP);
  assert.ok(next.heading > 350 && next.heading < 350.01);
  const settled = run({ ...boat, heading: 350 }, { speed: 20, rudder: 0, heading: 10 }, 300);
  assert.ok(Math.abs(headingError(10, settled.heading)) < 0.3);
});

test("heading hold uses counter-rudder and settles without a heading jump", () => {
  let boat = initialState().own;
  let counterRudder = false, overshoot = 0;
  const command = { speed: 20, rudder: 0, heading: 90 };
  for (let i = 0; i < 9000; i++) {
    const next = steeringStep(boat, command, STEP);
    assert.ok(Math.abs(headingError(next.heading, boat.heading)) < 0.05);
    if (boat.heading < 90 && rudderOrder(boat, command) < 0) counterRudder = true;
    overshoot = Math.max(overshoot, next.heading - 90);
    boat = next;
  }
  assert.equal(counterRudder, true);
  assert.ok(overshoot < 3);
  assert.ok(Math.abs(headingError(90, boat.heading)) < 0.3);
  assert.ok(Math.abs(boat.yawRate) < 0.02);
});

test("a stopped ship cannot pivot just by ordering a heading", () => {
  const boat = { ...initialState().own, speed: 0 };
  const next = run(boat, { speed: 0, rudder: 0, heading: 90 }, 120);
  assert.equal(next.heading, boat.heading);
  assert.equal(next.x, boat.x);
  assert.equal(next.y, boat.y);
});

test("turning continues through inertia after ordering amidships", () => {
  const turning = run(initialState().own, { speed: 20, rudder: 35 }, 40);
  const centered = run(turning, { speed: 20, rudder: 0 }, 14);
  assert.ok(Math.abs(centered.rudder) < 1e-9);
  assert.ok(centered.yawRate > 0.1);
  assert.ok(centered.heading > turning.heading);
});

test("throttle response is gradual and low speed reduces rudder authority", () => {
  const start = initialState().own;
  const slowing = steeringStep(start, { speed: 0, rudder: 0 }, 1);
  assert.ok(slowing.speed > 19 && slowing.speed < 20);
  const slow = run({ ...start, speed: 5 }, { speed: 5, rudder: 35 }, 120);
  const fast = run(start, { speed: 20, rudder: 35 }, 120);
  assert.ok(slow.yawRate < fast.yawRate / 3);
});

test("each ship accepts its own helm, and reset clears yaw and heading orders", () => {
  const commands = defaultHelmCommands();
  commands.target = { speed: 12, rudder: 0, heading: 180 };
  let state = initialState();
  for (let i = 0; i < 300; i++) state = advance(state, commands, STEP);
  assert.equal(state.own.heading, 0);
  assert.ok(state.target.heading < 270);
  assert.ok(state.target.speed < 20 && state.target.speed > 12);
  assert.ok(state.target.rudder < 0);
  assert.equal(initialState().target.yawRate, 0);
  assert.equal(defaultHelmCommands().target.heading, null);
});

test("both watches log heading orders once without logging servo motion each tick", () => {
  const settings = defaultSettings();
  let state = createSimulation(settings);
  const commands = defaultHelmCommands();
  commands.own.heading = 30;
  commands.target.heading = 240;
  for (let i = 0; i < 300; i++) state = advanceSimulation(state, commands, STEP, settings);
  for (const id of ["own", "target"]) {
    const orders = state.bridge[id].logs.filter(log => log.source === "CONTROL" && log.message.includes("Heading hold"));
    assert.equal(orders.length, 1);
    assert.ok(orders[0].message.includes(id === "own" ? "030" : "240"));
  }
});
