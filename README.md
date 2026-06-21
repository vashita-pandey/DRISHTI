# DRISHTI — Edge AI for Aerospace Inspection
> *दृष्टि — Vision in Sanskrit*

**Tata InnoVent-27 | Category 3.2.3.4 — Edge AI for Intelligent Inspection & Defect Detection**

---

## What is DRISHTI?

DRISHTI is a Progressive Web App that gives an MRO (Maintenance, Repair & Overhaul) inspector an AI co-pilot in their pocket — running entirely on-device, with zero cloud dependency during inspection.

An inspector opens DRISHTI on any Android phone, points the camera at an aircraft surface, and the app detects cracks, corrosion, dents, and composite delamination in real time — offline, in a hangar, with no WiFi needed.

---

## The Problem

Aircraft maintenance inspectors at facilities like Tata Advanced Systems currently:

- Walk along airframe surfaces with a torch and a checklist
- Photograph defects on personal phones and send via WhatsApp for a second opinion
- Wait hours for a verdict on whether a crack is within tolerance
- Log findings manually in paper records — incomplete, unsearchable, not DGCA-compliant

**Three things go wrong:**
1. Human eyes miss sub-0.3mm cracks, especially under fatigue and poor hangar lighting
2. No structured defect memory — patterns that predict imminent failure go undetected
3. Verdict latency kills turnaround time — a grounded aircraft costs ₹5–10 lakh per hour

---

## The Solution — 3 Modules

### 📷 Module 1 — LiveScan
Real-time on-device defect detection via phone camera.

- Runs a YOLOv8n model (ONNX format) on the phone's GPU via WebGL — no server, no internet
- Detects and classifies: **cracks, corrosion, dents, paint blistering, composite delamination**
- Draws bounding boxes with defect type, estimated size in mm, and severity score (0–100)
- Compares detected crack geometry against **DGCA/FAA Airworthiness Directive tolerances** stored locally
- Returns PASS/FAIL verdict in under 2 seconds, standing in a hangar with no WiFi

### 📊 Module 2 — StructuredLog
Every detection is automatically saved to the phone's local storage (IndexedDB via Dexie.js):
- Aircraft tail number, zone, defect type, severity, crack length, verdict, timestamp, inspector ID
- Syncs to facility server when WiFi is available
- Replaces paper logbooks with machine-readable, DGCA-compliant structured records

### 📈 Module 3 — HistoryGraph
Fleet intelligence built on top of logged inspection records:
- **Crack progression timeline** per aircraft tail number
- **Paris' Law projection** (da/dN = C·ΔK^m) — forecasts when a crack will breach the DGCA tolerance limit
- **Fleet heatmap** — colour-coded aircraft diagram showing defect frequency per zone across all tail numbers
- Dynamic inspection interval recommendation based on actual crack growth rate

---

## Why This Is Real Edge AI

| What most teams build | What DRISHTI does |
|---|---|
| Cloud-connected detector that calls an API | Model runs on the phone's GPU via WebGL — zero server |
| Generic CV demo on COCO dataset | Trained on actual Boeing aircraft surface defect imagery |
| Linear regression for "prediction" | Paris' Law (da/dN = C·ΔK^m) — the aerospace industry standard |
| Dashboard with mock data | Physical demo: point phone at surface, see real inference |

---

## Tech Stack

| Layer | Technology |
|---|---|
| CV Model | YOLOv8n (Ultralytics) → ONNX export |
| On-device inference | ONNX Runtime Web (WebGL backend) |
| Frontend | React + Vite (PWA) |
| Offline storage | Dexie.js (IndexedDB wrapper) |
| Crack progression | Paris' Law in JavaScript — Boeing 737 Al 2024-T3 constants |
| Data visualisation | Recharts (timeline) + D3.js (fleet heatmap) |
| PWA offline | Workbox + vite-plugin-pwa |
| HTTPS local dev | vite-plugin-mkcert |

---

## Dataset

| Dataset | Role |
|---|---|
| Innovation Hangar v2 (Roboflow) | Primary — actual Boeing aircraft surface defects |
| CFRP Composite Defect Dataset | Carbon fibre delamination and porosity |
| NEU Metal Surface Defect | Augmentation only |
| Magnetic Tile Defect | Augmentation only |
| Synthetic (albumentations) | Brightness shifts, shadow overlays, gaussian noise — simulates hangar lighting |

---

## Paris' Law Implementation

DRISHTI uses Paris' Law to project crack growth — the same framework Boeing and Airbus use for damage tolerance assessment:

```
da/dN = C · ΔK^m
```

- `da/dN` = crack growth per load cycle
- `ΔK` = stress intensity factor range
- `C = 1.35×10⁻¹⁰`, `m = 3.0` — Boeing 737 aluminium alloy 2024-T3 constants

Output: *"Crack VT-ABC-Wing-07 will exceed tolerance in ~3 inspection cycles (~1,500 flight hours)"*

---

## Project Structure

```
DRISHTI/
├── public/
│   ├── model/              ← drishti.onnx goes here (Person A)
│   ├── manifest.json       ← PWA manifest
│   └── icon-192.png
├── src/
│   ├── components/
│   │   ├── LiveScan.jsx    ← camera + ONNX inference + bounding boxes
│   │   ├── ZoneSelector.jsx← Boeing 737 zone diagram (SVG)
│   │   └── HistoryGraph.jsx← crack timeline + Paris' Law + fleet heatmap
│   ├── db/
│   │   └── db.js           ← Dexie.js local database schema
│   ├── data/
│   │   └── tolerance_737.json ← DGCA go/no-go thresholds per zone
│   ├── inference.js        ← ONNX Runtime Web inference pipeline
│   ├── utils.js            ← severity scoring + verdict logic
│   └── App.jsx             ← tab navigation
├── vite.config.js
└── package.json
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- Android phone on the same WiFi network (for phone testing)

### Run locally

```bash
git clone https://github.com/vashita-pandey/DRISHTI.git
cd DRISHTI
npm install
npm run dev -- --host
```

Open `https://localhost:5173` on your laptop or the Network URL on your phone.

> Your browser may warn about a self-signed certificate — click **Advanced → Proceed anyway**. This is expected for local HTTPS development.

### Adding the ONNX model (Person A)

Once the YOLOv8n model is trained and exported:

```bash
# Copy the model file to:
public/model/drishti.onnx

# Then push to GitHub:
git add public/model/drishti.onnx
git commit -m "add trained ONNX model v1"
git push
```

The inference pipeline in `src/inference.js` automatically loads it. No other changes needed.

## Business Impact

- **₹5–10 lakh/hour** ground cost eliminated by removing the WhatsApp verdict loop
- **DGCA compliance** — structured, auditable, timestamped records replace paper logs
- **Fleet intelligence** — Paris' Law projection catches systematic issues months before manual analysis
- **Junior inspector augmentation** — any inspector performs at senior engineer quality level
- **Zero capital expenditure** — runs on any Android phone already in the inspector's pocket

---

## Hackathon

**Tata InnoVent-27** | Theme: AI at the Edge
Category 3.2.3.4 — Edge AI for Intelligent Inspection & Defect Detection (Aerospace)
Partners: Tata Technologies × Emerson Test & Measurement × AWS