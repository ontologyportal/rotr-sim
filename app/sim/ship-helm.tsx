"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { bearingText } from "./units.mjs";
import { normalizeHeading, rudderOrder, type HelmCommand } from "./steering.mjs";
import type { createSimulation, ShipId } from "./watchkeeping.mjs";

type Vessel = ReturnType<typeof createSimulation>["own"];
type Props = { id: ShipId; vessel: Vessel; command: HelmCommand; disabled: boolean; onChange: (command: HelmCommand) => void };
const point = (angle: number, radius: number) => {
  const radians = angle * Math.PI / 180;
  return { x: 110 + Math.sin(radians) * radius, y: 110 - Math.cos(radians) * radius };
};
const arc = (start: number, end: number, radius: number) => {
  const a = point(start, radius), b = point(end, radius);
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${end - start > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
};
const rudderText = (angle: number) => Math.abs(angle) < 0.05 ? "Amidships" : `${Math.abs(angle).toFixed(1)}° ${angle < 0 ? "port" : "starboard"}`;

export default function ShipHelm({ id, vessel, command, disabled, onChange }: Props) {
  const ship = id === "own" ? "Ship 01" : "Ship 02";
  const ordered = command.heading ?? vessel.heading;
  const hold = command.heading !== null;
  const order = rudderOrder(vessel, command);
  const setHeading = (heading: number) => onChange({ ...command, heading: normalizeHeading(heading) });
  const steer = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    if (Math.hypot(x, y) < bounds.width * 0.16) return;
    setHeading(Math.round(normalizeHeading(Math.atan2(x, -y) * 180 / Math.PI)));
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const delta = event.shiftKey ? 10 : 1;
    const keys: Record<string, number> = { ArrowRight: delta, ArrowUp: delta, ArrowLeft: -delta, ArrowDown: -delta, PageUp: 10, PageDown: -10 };
    if (event.key in keys || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setHeading(event.key === "Home" ? 0 : event.key === "End" ? 359 : ordered + keys[event.key]);
    }
  };
  return <section className="ship-helm" aria-label={`${ship} helm controls`}>
    <div className="helm-instruments">
      <div className="throttle-instrument">
        <div className="instrument-title"><h4>Throttle</h4><span>AHEAD</span></div>
        <svg viewBox="0 0 220 220" role="img" aria-label={`${ship} speed ${vessel.speed.toFixed(1)} knots, ordered ${command.speed.toFixed(1)} knots`}>
          <circle cx="110" cy="110" r="103" className="dial-face" />
          <path d={arc(210, 510, 88)} className="gauge-track" />
          <path d={arc(210, 210 + vessel.speed / 30 * 300, 88)} className="gauge-speed" />
          {Array.from({ length: 31 }, (_, i) => {
            const angle = 210 + i * 10, a = point(angle, i % 5 ? 78 : 74), b = point(angle, 83), label = point(angle, 62);
            return <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="dial-tick" />{i % 5 === 0 && <text x={label.x} y={label.y + 4} className="dial-number">{i}</text>}</g>;
          })}
          <g transform={`rotate(${210 + command.speed * 10} 110 110)`}><path d="M104 9 L116 9 L110 23 Z" className="order-marker" /></g>
          <g transform={`rotate(${210 + vessel.speed * 10} 110 110)`}><line x1="110" y1="110" x2="110" y2="59" className="speed-needle" /></g>
          <circle cx="110" cy="110" r="5" className="needle-hub" />
          <text x="110" y="151" className="dial-value">{vessel.speed.toFixed(1)}</text><text x="110" y="167" className="dial-caption">KNOTS</text>
        </svg>
        <label className="helm-order" htmlFor={`${id}-throttle`}>Speed order <strong>{command.speed.toFixed(1)} kt</strong></label>
        <input id={`${id}-throttle`} aria-label={`${ship} throttle speed order`} type="range" min="0" max="30" step="0.5" value={command.speed} disabled={disabled} onChange={e => onChange({ ...command, speed: Number(e.target.value) })} />
        <div className="throttle-presets">{[["Stop", 0], ["⅓", 10], ["⅔", 20], ["Full", 30]].map(([label, speed]) => <button key={label} disabled={disabled} aria-label={`${ship} throttle ${label}`} onClick={() => onChange({ ...command, speed: Number(speed) })}>{label}</button>)}</div>
      </div>
      <div className="compass-instrument">
        <div className="instrument-title"><h4>Heading</h4><span>{hold ? "HOLD" : "MANUAL"}</span></div>
        <div className="heading-compass" role="slider" aria-label={`${ship} desired heading`} aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(ordered) % 360} aria-valuetext={`${bearingText(ordered)}${hold ? ", heading hold" : ", manual helm"}`} aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
          onKeyDown={keyboard} onPointerDown={event => { if (!disabled) { event.currentTarget.setPointerCapture(event.pointerId); steer(event); } }}
          onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) steer(event); }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
          <svg viewBox="0 0 220 220" aria-hidden="true">
            <circle cx="110" cy="110" r="103" className="dial-face" /><circle cx="110" cy="110" r="87" className="compass-ring" />
            {Array.from({ length: 72 }, (_, i) => {
              const angle = i * 5, a = point(angle, i % 6 ? 79 : 72), b = point(angle, 85), label = point(angle, 59);
              return <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="dial-tick" />{i % 6 === 0 && <text x={label.x} y={label.y + 4} className={`dial-number ${i % 18 === 0 ? "cardinal" : ""}`}>{i % 18 === 0 ? ["N", "E", "S", "W"][i / 18] : angle}</text>}</g>;
            })}
            {hold && <g transform={`rotate(${ordered} 110 110)`}><path d="M103 8 L117 8 L110 24 Z" className="order-marker" /><line x1="110" y1="28" x2="110" y2="85" className="heading-order-line" /></g>}
            <g transform={`rotate(${vessel.heading} 110 110)`}><path d="M110 76 L118 101 L118 135 L102 135 L102 101 Z" className="compass-ship" /><line x1="110" y1="76" x2="110" y2="40" className="heading-line" /></g>
          </svg>
        </div>
        <div className="heading-readout"><strong>{bearingText(vessel.heading)}</strong><span>ACTUAL</span></div>
        <label className="heading-order-input">Order <input aria-label={`${ship} heading order degrees true`} type="number" min="0" max="359" step="1" value={Math.round(ordered) % 360} disabled={disabled} onChange={event => { if (event.target.value !== "") setHeading(Number(event.target.value)); }} /><span>°T</span></label>
      </div>
    </div>
    <div className="heading-hold-row"><span><i className={hold ? "hold-on" : ""} />{hold ? `Holding ${bearingText(ordered)}` : "Manual rudder"}</span><button disabled={disabled} aria-pressed={hold} onClick={() => onChange({ ...command, heading: hold ? null : vessel.heading, rudder: vessel.rudder })}>{hold ? "Manual helm" : "Hold heading"}</button></div>
    <p className="helm-hint">Drag the compass ring to set a heading. Arrow keys adjust 1°; Shift adjusts 10°.</p>
    <div className="rudder-instrument">
      <div className="helm-order"><span>Rudder <strong>{rudderText(vessel.rudder)}</strong></span><span>Order {rudderText(order)}</span></div>
      <div className="rudder-scale" role="img" aria-label={`${ship} actual rudder ${rudderText(vessel.rudder)}, ordered ${rudderText(order)}`}><div className="rudder-center" /><span className="rudder-order-mark" style={{ left: `${50 + order / 70 * 100}%` }} /><span className="rudder-actual-mark" style={{ left: `${50 + vessel.rudder / 70 * 100}%` }} /></div>
      <input aria-label={`${ship} manual rudder order`} type="range" min="-35" max="35" step="1" value={hold ? Math.round(order) : command.rudder} disabled={disabled} onChange={e => onChange({ ...command, heading: null, rudder: Number(e.target.value) })} />
      <div className="range-labels"><span>35° PORT</span><button disabled={disabled} className="text-button" onClick={() => onChange({ ...command, heading: null, rudder: 0 })}>Amidships / manual</button><span>35° STBD</span></div>
    </div>
  </section>;
}
