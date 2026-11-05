"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createVessel, encounter, hull, scenario, STEP, WORLD } from "./sim/model.mjs";
import { createSimulation, advanceSimulation, observe, defaultSettings, emitSignal, type Settings, type ShipId } from "./sim/watchkeeping.mjs";
import { rangeText, feet, longTons, tcpaText } from "./sim/units.mjs";
import Watchkeeping from "./sim/watchkeeping-panel";
import { defaultHelmCommands, type HelmCommand } from "./sim/steering.mjs";

const OceanScene = dynamic(() => import("./sim/ocean-scene"), { ssr: false, loading: () => <div className="ocean-loading">Preparing the 3D ocean...</div> });

export default function Home() {
  const [state, setState] = useState(createSimulation);
  const [running, setRunning] = useState(false);
  const [helms, setHelms] = useState(defaultHelmCommands);
  const [rate, setRate] = useState(1);
  const [settings, setSettings] = useState(defaultSettings);
  const settingsRef = useRef(defaultSettings());
  const [{ vessel, error }] = useState(() => {
    try { return { vessel: createVessel(), error: "" }; }
    catch (e) { return { vessel: null, error: e instanceof Error ? e.message : String(e) }; }
  });
  const live = useRef(createSimulation());
  const command = useRef({ ...helms, rate });
  useEffect(() => { command.current = { ...helms, rate }; }, [helms, rate]);
  useEffect(() => {
    if (!running) return;
    let frame = 0, previous = 0, accumulated = 0, lastDisplay = 0;
    const tick = (now: number) => {
      if (previous) accumulated += Math.min((now - previous) / 1000, 0.1) * command.current.rate;
      previous = now;
      while (accumulated >= STEP) {
        live.current = advanceSimulation(live.current, command.current, STEP, settingsRef.current);
        accumulated -= STEP;
        if (live.current.collision) {
          setState(live.current);
          setRunning(false);
          return;
        }
      }
      if (now - lastDisplay >= 50) { setState(live.current); lastDisplay = now; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
  const reset = () => {
    setRunning(false); command.current = { ...defaultHelmCommands(), rate };
    live.current = createSimulation(settingsRef.current); setState(live.current);
    setHelms(defaultHelmCommands());
  };
  const changeHelm = (ship: ShipId, next: HelmCommand) => {
    if (live.current.collision) return;
    const commands = { ...command.current, [ship]: next };
    command.current = commands;
    setHelms({ own: commands.own, target: commands.target });
    live.current = { ...live.current, bridge: observe(live.current, live.current.bridge, settingsRef.current, commands) };
    setState(live.current);
  };
  const changeSettings = (next: Settings) => {
    settingsRef.current = next;
    setSettings(next);
    live.current = { ...live.current, bridge: observe(live.current, live.current.bridge, next, command.current) };
    setState(live.current);
  };
  const signal = (ship: ShipId, kind: "horn" | "vhf") => {
    live.current = emitSignal(live.current, settingsRef.current, ship, kind);
    setState(live.current);
  };
  const approach = encounter(state);
  const close = approach.dcpa < 50 && approach.tcpa > 0;
  const outside = [state.own, state.target].some(b => b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height);
  const clock = `${Math.floor((state.time + 1e-6) / 60).toString().padStart(2, "0")}:${Math.floor((state.time + 1e-6) % 60).toString().padStart(2, "0")}`;

  return <main className="sim-shell">
    <header className="topbar">
      <Link className="brand" href="/" aria-label="ROTR simulation home"><span className="brand-mark">R</span><span>ROTR<span className="brand-light"> / SIM</span></span></Link>
      <span className="environment"><i /> LOCAL SIMULATION</span>
    </header>
    <section className="heading"><div><p className="eyebrow">NAVIGATION LAB / SCENARIO 001</p><h1>{scenario.title}</h1><p>{scenario.description}</p></div><div className="engine-badge">POWERED BY <strong>Vessel.js</strong></div></section>
    <div className="workspace">
      <section className="chart-panel" aria-label="3D ocean simulation">
        <div className="chart-toolbar"><div className="chart-actions"><button className="primary" disabled={!vessel || !!error || !!state.collision} onClick={() => setRunning(!running)}>{running ? "Pause" : "Run"}</button><button onClick={reset}>Reset</button><label className="rate">Time scale <select value={rate} onChange={e => setRate(Number(e.target.value))}><option value="1">1x</option><option value="5">5x</option><option value="10">10x</option><option value="20">20x</option></select></label></div><span className="clock">T + {clock}</span></div>
        {state.collision && <div className="collision-banner" role="alert"><div><strong>Collision detected</strong><p>Hull contact at {state.collision.time.toFixed(1)} s. Simulation paused. Reset to try another maneuver.</p></div><button onClick={reset}>Restart encounter</button></div>}
        <div className="chart-wrap">
          <OceanScene simulation={live} snapshot={state} settings={settings} onSettings={changeSettings} onSignal={signal} />
        </div>
      </section>
      <aside>
        <section className="panel helm-guide"><div className="panel-title"><h2>Bridge controls</h2><span className="tag">TWO SHIPS</span></div><p className="note">Use each ship’s throttle and heading compass below the ocean view. The gold marker shows the order; the ship pointer shows the actual heading.</p><a className="helm-jump" href="#ship-controls">Go to ship controls ↓</a><p className="note">Heading hold steers through the rudder. Allow time for the ship to answer the helm.</p></section>
        <section className="panel"><div className="panel-title"><h2>Encounter / ground truth</h2><span className={`tag ${state.collision ? "danger" : close ? "amber" : ""}`}>{state.collision ? "COLLISION" : close ? "CLOSE APPROACH" : "MONITORING"}</span></div><dl><div><dt>Target range</dt><dd>{rangeText(approach.range)}</dd></div><div><dt>Closest approach</dt><dd>{rangeText(approach.dcpa)}</dd></div><div><dt>Time to closest approach</dt><dd>{approach.tcpa > 0 ? tcpaText(approach.tcpa) : "Now / opening"}</dd></div></dl><p className="note">Prediction assumes both vessels hold their present course and speed.</p></section>
        <section className="panel hull-panel"><div className="panel-title"><h2>Vessel model</h2><span className="tag">VESSEL.JS</span></div><dl><div><dt>Length / beam</dt><dd>{feet(hull.length).toFixed(1)} / {feet(hull.beam).toFixed(1)} ft</dd></div><div><dt>Design draft</dt><dd>{feet(hull.draft).toFixed(1)} ft</dd></div><div><dt>Displacement</dt><dd>{vessel ? `${longTons(vessel.displacement).toFixed(1)} LT` : "Loading..."}</dd></div></dl><p className="note">Box hull hydrostatics from Vessel.js. Motion uses a simplified steering model.</p></section>
      </aside>
    </div>
    <div id="ship-controls"><Watchkeeping state={state} commands={helms} onCommand={changeHelm} settings={settings} onSettings={changeSettings} onSignal={signal} /></div>
    <footer><span>Manual navigation sandbox</span><span>Sigma reasoning: not connected</span></footer>
    {outside && <p className="notice" role="status">A vessel has left the initial scenario area. Use Follow vessel or reset the encounter.</p>}
    {error && <p className="notice" role="alert">Vessel.js could not initialize: {error}</p>}
  </main>;
}
