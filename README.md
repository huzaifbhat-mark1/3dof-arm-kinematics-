# Arm Lab

A local 3D robotic-arm playground: three joints, a gripper, saved poses, and smooth sequence playback.

## Start on your laptop

1. Open this `arm-lab` folder in VS Code.
2. Open **Terminal → New Terminal**.
3. Run `node server.mjs` (or `npm start`). Node.js 18 or newer is required; your laptop already has Node.
4. Open **http://127.0.0.1:4173** in Chrome or Edge.
5. Keep the terminal running. Press **Ctrl+C** to stop the server.

On Windows, you can also double-click `Start Arm Lab.cmd`. The server binds only to your computer. No package install, account, external font, CDN, or API key is needed. Internet is not needed after you have this folder and Node. Opening `index.html` directly is not supported because it uses JavaScript modules.

If port 4173 is used by another app, in PowerShell run:

```powershell
$env:PORT = '4174'
node server.mjs
```

Then visit http://127.0.0.1:4174. Browser storage is specific to the browser and address, including the port; export before switching addresses.

## Make your first sequence

1. Drag the model to orbit the camera; scroll to zoom. **3D**, **Front**, and **Top** switch views. The camera reset button restores the default view.
2. Use the sliders or numeric fields to move the base, shoulder, elbow, and gripper. **0% gripper = closed; 100% = open.** The joint reset button returns to the home pose.
3. Click **Save current pose**, give it a name, and set the time needed to reach it.
4. Save several poses. Click a pose to load it. **Update** replaces that pose's joint positions with the current controls. The pencil edits its name and duration. Arrows reorder it; **×** removes it.
5. Click **Play sequence**. It moves from your current position to the first pose, then through each saved pose. Durations belong to destinations. Motion uses smooth easing at each endpoint.
6. Pause/resume, change speed, or enable looping. A loop moves smoothly from the last pose back to the first. Stop returns to the position at which playback began. Editing a joint cancels playback and keeps the current position.
7. Poses save automatically in browser storage. **Export** downloads a portable JSON copy. **Import** validates a file and asks before replacing the current sequence. Up to 40 poses are supported.

The initial Ready → Reach → Grasp → Lift sequence is a motion example. It does not pick up a simulated object. You can replace all four starter poses.

Keyboard: **Space** plays/pauses and **P** opens Save Pose when focus is outside a control. **Escape** closes a dialog. All controls also work with Tab and native keyboard input. The animation pauses when the tab is hidden.

## What the coordinates mean

The readout tracks the tool centre in centimetres: **Y is up**, X/Z are the work surface. The base yaw rotates around Y. Shoulder and elbow angles are relative to their parent link. Zero shoulder and elbow point straight up. The model dimensions are a 11 cm shoulder height, 23 cm upper arm, 20 cm forearm, and 6.5 cm tool offset. These are illustrative and can be changed in `model.js` (the decorative geometry may also need adjustment).

This is a kinematic visualizer. It does not simulate gravity, motor torque, payload, self-collision, joint backlash, or grip contact. A warning appears when the tool centre is below the floor; this is not a complete collision check. Hardware requires different, calibrated movement limits.

## Connect your Arduino Uno later

### Parts and wiring

A matching arm needs **four positional servos**: base, shoulder, elbow, and gripper. With your current two servos, first build a two-axis or single-joint demonstration. You will need two additional servos for all four controls, and shoulder torque must be sized for the arm's actual weight and reach. Continuous-rotation servos are not suitable as direct angle-controlled joints.

| Servo | Uno signal pin | Power |
|---|---|---|
| Base | D3 | External regulated servo supply |
| Shoulder | D5 | External regulated servo supply |
| Elbow | D6 | External regulated servo supply |
| Gripper | D9 | External regulated servo supply |

Connect servo grounds and the external supply ground to **Uno GND**. Power the Uno through USB. Use the voltage specified for your servos and a supply capable of their combined current, including stalls. Do not run four servos from the Uno's 5V pin or connect the external servo positive rail to that pin. D3/D5/D6/D9 are convenient signal assignments; the Servo library creates its own timing rather than using analogWrite PWM.

### Firmware starter

`arduino/arm_lab_uno.ino` is a complete optional starter using the Arduino Servo library. It has conservative example limits, strict command parsing, an explicit ARM command, and rate-limited movement. It was supplied for later hardware work; it has not been compiled or tested on your Uno.

1. Support the arm mechanically and test **one unloaded servo** before fitting any linkage. Disconnect other servo signals during calibration.
2. In the Arduino IDE, open the `.ino` file, install the Servo library if missing, select **Arduino Uno**, select its USB port, and upload.
3. Use Serial Monitor at **115200 baud**, with newline line endings.
4. `ARM` attaches all four outputs at their configured neutral angles. A servo can move immediately when attached, so establish a safe neutral with the linkage disconnected.
5. `SET,90,90,90,90` commands base, shoulder, elbow, and gripper **servo angles**, not simulator angles. The example bounds are 60–120° for the three joints and 80–100° for the gripper. These are placeholders, not a physical calibration.
6. `STOP` detaches outputs and releases holding torque. Support the arm before doing this. There is no automatic communications-loss detach, because an unsupported arm could fall; design the appropriate physical stop and timeout behavior for your build.

### Future browser connection

Add a **Connect Arduino** button using Web Serial in a supported desktop Chrome or Edge browser at the localhost address. The connection must start with a user click and a port choice. Close Serial Monitor first, open the port at 115200 baud, wait for the Uno reset/READY message, and keep the arm disarmed until calibration has been verified.

Before sending positions, map each virtual angle to a calibrated real servo angle with an offset, direction, and scale:

```text
servoAngle = clamp(neutral + direction × virtualAngle × scale, safeMin, safeMax)
gripperAngle = closedAngle + openingPercent / 100 × (openAngle - closedAngle)
```

Virtual base travel is −180° to +180°, which exceeds a typical hobby servo's range. Restrict the simulator controls to the real calibrated range or explicitly scale them; the physical arm will otherwise not match the preview. Shoulder and elbow signs also depend on how your servos are mounted. Check every joint independently.

Once calibrated, send newline-terminated `SET,b,s,e,g` commands at a modest rate (for example, 20 Hz), read OK/ERR replies, and provide a visible armed state and a physical stop. The included firmware also limits movement to one degree per 20 ms; very fast simulator playback will not be followed exactly. Align the physical speed and limits before attempting synchronized playback.

The current app deliberately has no active serial connection. Connecting hardware is a separate next step after the mechanism and calibration are ready.

## Test and modify

```powershell
npm test
```

Tests cover forward kinematics against composed Three.js transforms, interpolation, sequence endpoints, loop continuity, empty sequences, and malformed imports.

Files:
