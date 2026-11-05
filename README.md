# ROTR / SIM

A 3D ocean navigation sandbox using Vessel.js and Three.js, separate from Sigma.
Inspired by https://shiplab.github.io/vesseljs/examples/Many_ships_in_regular_ocean.html.

## Run

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Each ship has an independent throttle, heading
compass, and manual rudder below the ocean view. Click **Run** to advance time.
Drag the compass ring or enter a true heading to engage heading hold; the
controller moves the rudder to follow the order. Arrow keys on the compass
adjust 1 degree (Shift: 10 degrees). Manual rudder input disengages heading hold.
**Amidships / manual** centers the rudder; the ship takes time to stop turning.
**Reset** restores both ships and clears heading orders. Time can run at 1x,
5x, 10x, or 20x. Pause freezes navigation and the wave clock.

## 3D view

- Drag to orbit, scroll/pinch to zoom, and right-drag/two-finger drag to pan.
- **Follow vessel** keeps the camera with your vessel. Clicking it again resets
  the camera. **Overview** frames the encounter; **Overhead** gives a plan view.
- **Sea** changes the swell amplitude: calm, moderate, or rough.
- Water, reflections, sky, ship geometry, wake textures, and labels are generated
  locally. No external model or texture downloads are needed at runtime.
- A WebGL-capable browser with hardware acceleration is required. The scene
  resizes with its container and releases graphics resources when unmounted.

## Naval vessel appearance

Both vessels load the local `public/models/naval-battleship.glb` asset, **low poly
battleship** by angelo raffaele Catalano, from https://poly.pizza/m/cqV6mUkn7Ow,
licensed under CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/).
The model is rescaled to the existing 20 m by 6 m simulation envelope and placed
at the design waterline. Its open library hull panels are replaced by a closed hull with sides, transom,
and bottom, following the original deck seam and the 1.5 m design draft.
The original deck and superstructure remain in place. These are stylized naval visuals, not a calibrated
full-size battleship dynamics model. Existing Vessel.js hydrostatics, steering,
sensors, and conservative rectangular collision envelopes remain unchanged.
Each ship keeps its colored identity label. The original launch is a loading/error
fallback. Attribution is also displayed in the scene.

## Scene controls

The top toolbar selects the watch and camera view. **Sensors** opens the colored
layer switches and symbol key; its count shows enabled layers. **Settings** groups
sea state and test horn/VHF controls, including a sender selector in observer mode.
Only enabled layers appear in the compact bottom readouts. Escape or the close
button dismisses an open panel. Vessel labels stay small when zooming.

## Sensor overlays

Detection colors are shared by both ships, the 3D overlays, and terminal logs:
lookout green, radar cyan, ARPA purple, AIS yellow, sound orange, VHF pink,
and own navigation blue. Ship identity remains in the 01/02 labels.

All six overlay layers start **off**; use the scene checkboxes to enable them.
Detection equipment and per-ship logs continue operating independently.


The 3D scene has **Observer**, **Ship 01**, and **Ship 02** sensor views, plus
independent display toggles for lookout, radar, ARPA, AIS, sound, and VHF.
Display toggles do not switch physical equipment off; receiver equipment
controls remain in each vessel's section below the scene.

- Observer mode shows both ground-truth hulls/trails with both ships' received
  overlays. Ship views show only their own live hull/trail; the other vessel is
  represented by received contact markers. Camera overview uses received target
  locations in ship views, rather than the hidden live vessel position.
- Lookout draws a visibility boundary, last-observed sight line, and contact
  marker; night labels describe the observed light sector. The visibility
  setting affects contacts, not the observer sky. Fresh markers expire after 6 s.
- Radar draws a rotating 500 m display sweep and 250/500 m reference rings.
  The simulated radar still has 6 km detection range. Echoes are circles with
  a bounded range/bearing error envelope, fading between scans. Every scan
  stores its observer origin, so an old echo stays fixed at its measured location.
- ARPA draws a dashed 60 s estimated target vector, plus estimated CPA markers
  and separation when closing within a 180 s display horizon. These are numeric
  estimates, not COLREGS decisions.
- AIS uses triangular markers at delivered report locations; heading comes
  from the report. Labels show message age, and markers fade until expiry.
- Test horns show expanding emission rings only in observer mode. Receivers
  show a temporary approximate bearing sector, explicitly with unknown range.
  VHF shows transmission indicators in observer mode and reception labels after
  delivery. Radio reception does not imply a maneuver agreement.
- Cyan identifies Ship 01's watch; amber identifies Ship 02's watch. Marker
  shapes, line styles, labels, and the scene legend distinguish sensor systems.
- Overlays are rendered as a separate HUD pass, so they do not reflect in the
  physical water. Their animations, ages, and expiry use simulation time and
  freeze when paused. Reset clears pending and received signal indicators.
## Model

- Vessel.js constructs the 20 x 6 x 4 m box hull and computes submerged volume
  and displacement at 1.5 m draft, using seawater density 1025 kg/m3.
- `app/sim/model.mjs` owns the state, fixed-step advancement, and constant-velocity
  closest-approach prediction. Coordinates are metres east/north, headings are
  clockwise from north, and speeds are knots.
- `app/sim/ocean-scene.tsx` renders the hulls and superstructures using Three.js,
  with OrbitControls, the Sky atmosphere, and the reflective Water shader.
  A two-component regular swell displaces the ocean surface. Sampling that same
  surface at the hull centre, bow/stern, and sides drives heave, pitch, and roll.
- `app/sim/steering.mjs` supplies both ships' motion and the observer prediction
  vectors. Throttle orders use 35-second acceleration and 55-second deceleration
  time constants. Rudder deflection is limited to +/-35 degrees and travel to
  2.5 degrees/second (65 degrees in 26 seconds). Yaw follows a first-order Nomoto
  response with a 20-second time constant at 20 kt and a steady hard-over radius
  of 2.8 hull lengths; steering authority falls with forward speed.
  Heading hold uses the shortest angular error plus yaw-rate feedback to apply
  counter-rudder before reaching the ordered heading. It never sets heading
  directly. These are illustrative training parameters, not calibrated vessel
  coefficients or Vessel.js WaveMotion calculations. Hull contact pauses the
  simulation; impacts do not apply bounce or damage.
- Both vessels start at 20 kt, with the amber vessel heading 270 degrees.
  Its throttle and helm can be controlled independently. The initial courses intersect.
  Boats continue outside the starting scenario area; the camera follows them.
- `vendor/` contains the standalone Vessel.js 0.0.14 module and MIT license;
  see `vendor/README.md` for provenance.

## Collisions

Hull contact uses the separating axis theorem on both oriented 155 x 20 m hull
footprints, including edge contact. The model checks each 1/30-second step;
wave heave, pitch, roll, railings, and fenders are excluded from this horizontal
footprint. This is discrete contact detection for the current speed range.

On impact, the model records simulation time and latches the collision state.
Navigation and wave time freeze, both hulls glow red with red outlines, and
an alert offers **Restart encounter**. Playback and helm controls remain
locked until reset. Speeds shown at impact are the frozen pre-impact speeds;
there is no rigid-body impulse or damage model.

To reproduce, reset, leave both ships at 20 kt / amidships, and run at 10x.
Contact occurs at about 157 simulation seconds (roughly 15.7 real seconds).
Turn early to avoid the encounter. Closest-approach prediction remains a
separate warning; only actual hull contact triggers the stop.

## Per-ship sensor and controller logs

Below the ocean are independent watchkeeping columns for each vessel.
Each includes live simulation-state statistics: current and target speed,
heading, applied and commanded rudder, controller mode, and east/north position.
The gauges distinguish actual speed and heading from ordered speed and heading.
The gold bug is the order; the ship pointer shows actual heading. Rudder travel,
yaw inertia, and throttle lag remain active in manual and heading-hold modes.
Commands can be edited while paused and take effect when time resumes.
Vessel statistics and each ship's watchkeeping log are expandable, closed by
default. Expanding one ship's log does not open the other ship's log.

Sensor observations are shown separately:

- Own navigation instruments (GNSS, heading, speed) sample every second.
- Visual lookout samples every five seconds within the selected visibility.
  Daytime recognition assumes a power-driven vessel; night reports visible
  navigation-light sectors. Three observations support a compass-bearing trend.
- Radar provides noisy range/bearing every two seconds within 6 km. ARPA
  estimates relative motion from at least three scans, with deliberately
  accelerated acquisition for this short training encounter. Errors are
  deterministic (2 m range / 0.15 deg bearing), not a calibrated sensor model.
- AIS sends every five seconds within 10 km, arrives two seconds late, and
  expires at 15 seconds of age. It is supplemental, unverified information;
  AIS alone never establishes visual contact or a safe situation.
- Equipment toggles are independent for each ship. Visual lookout can be
  disabled as an experimental sensor failure condition.
- **Sound test horn** and **VHF: request intentions** enqueue synthetic signals
  for the other ship. Hearing requires an enabled receiver and range within
  1 km, with propagation delay; VHF requires enabled radios and range within
  10 km, with a one-second delay. No real audio/radio is transmitted. Horns
  are unclassified test events, not a complete Rule 34/35 signaling model.
- Visibility and day/night settings affect detections, not the observer camera.
  The ocean and sidebar encounter values are explicitly ground-truth views.

The simulator produces sensor observations, numeric bearing trends, radar motion
estimates, and actual controller-command logs. COLREGS interpretation and
maneuver decisions belong in SUO-KIF; no JavaScript rule/advisory policy runs.
SUO-KIF reasoning is not connected yet. Collision evaluator events are labeled
as ground truth. Pause freezes observation clocks, and reset clears histories
and pending messages while retaining equipment/environment settings.

Each column filters sensor, controller, and system entries. The terminal
output uses elapsed HH:MM:SS.mmm timestamps and appends events chronologically.
Follow mode scrolls to new output; scrolling up pauses following. The latest
300 events per ship are retained. **Export logs**
downloads the retained histories, timestamps, and configuration as JSON.

References:
- https://www.navcen.uscg.gov/navigation-rules-amalgamated
- https://www.gov.uk/government/publications/mgn-379-mf-amendment-1-use-of-electronic-navigational-aids/mgn-379-mf-amendment-1-use-of-electronic-navigational-aids

## Sigma integration boundary

Sigma is not connected yet. A future worker or service can consume the state
from `initialState` / `advance` and return `{ speed, rudder }` commands. Keep
ontology loading and theorem proving outside the rendering loop. Associate
reasoning responses with a simulation state revision before applying them.
The renderer reads the existing live state; it does not own the navigation model.

## Checks

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Navigation display units

Controls, statistics, overlays, and log messages use knots (`kt`), nautical miles
(`NM`) for ranges at/above 200 yards and yards (`yd`) for closer ranges, feet
(`ft`) for vessel dimensions/draft, long tons (`LT`) for displacement, and minutes
for TCPA. Local east/north coordinates are yards from the scenario origin, not
latitude/longitude. Headings and bearings use zero-padded degrees true (`°T`);
rudder angles and bearing changes use degrees without a true-north suffix.
Sensor report ages and the elapsed simulation clock remain seconds.

Conversion uses exact 1 NM = 1852 m, 1 yd = 0.9144 m, 1 ft = 0.3048 m, and
1 LT = 1016.0469088 kg. Dynamics, sensor thresholds, and exported settings remain
in their original internal units; export version 3 identifies the units explicitly.

References: [USNA navigation electronics guidance](https://www.usna.edu/Sailing/_files/documents/2019_OSTS_Documents/MK_II_Electronics_Lecture_2019%2C_v11.0.pdf)
(ranges in nautical miles, yards inside 200 yards), and
[U.S. Navy vessel specifications](https://www.cpf.navy.mil/newsroom/news/article/2637476/newly-commissioned-uss-tripoli-departs-shipyard-for-san-diego/)
(feet, long tons, knots).

## Steering model references

The first-order yaw-response structure follows the Nomoto model described in
[Ejaz and Chen, 2017](https://journals.sagepub.com/doi/full/10.1177/1729881417703568).
The chosen 2.5 degree/second actuator rate is consistent with the 65-degree /
28-second steering-gear travel benchmark in
[IMO resolution A.1120(30), section 5.1.3.36](https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.1120%2830%29.pdf).
This benchmark informs actuator travel only; it does not calibrate this hull's
turning performance. The gauges and fjord scenery are visually inspired by the
[Vessel.js Trondheim example](https://shiplab.github.io/vesseljs/examples/trondheim.html).
