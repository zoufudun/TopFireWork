import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Info,
  Network,
  RefreshCw,
  Search,
  Sliders,
  Terminal,
  Wifi,
  WifiOff
} from "lucide-react";
import { useFireStore } from "../store/useFireStore";
import type { DeviceStatus, TopologyDevice } from "../types";

// Static definitions declared outside to prevent memory reallocation and flicker on ticks
const MAX_ROWS = 7;
const BRANCH_NAMES = [
  "分支一 (主干电缆干线)",
  "分支二 (由分支一节点间引出)",
  "分支三 (并联电缆干线 A)",
  "分支四 (由分支三节点间引出)",
  "分支五 (并联电缆干线 B)"
];

const SLOTS = [
  // Column 0 (Branch 1): Rows 1, 2, 3, 4, 5
  { r: 1, c: 0 },
  { r: 2, c: 0 },
  { r: 3, c: 0 },
  { r: 4, c: 0 },
  { r: 5, c: 0 },

  // Column 1 (Branch 2): Rows 2, 3, 4, 5, 6 (splits between Row 1 and Row 2 of Branch 1)
  { r: 2, c: 1 },
  { r: 3, c: 1 },
  { r: 4, c: 1 },
  { r: 5, c: 1 },
  { r: 6, c: 1 },

  // Column 2 (Branch 3): Rows 1, 2, 3, 4, 5, 6 (splits from Parent Node at Row 0)
  { r: 1, c: 2 },
  { r: 2, c: 2 },
  { r: 3, c: 2 },
  { r: 4, c: 2 },
  { r: 5, c: 2 }, { r: 6, c: 2 },

  // Column 3 (Branch 4): Rows 3, 4, 5 (splits between Row 2 and Row 3 of Branch 3)
  { r: 3, c: 3 },
  { r: 4, c: 3 },
  { r: 5, c: 3 },

  // Column 4 (Branch 5): Row 1 (splits from Parent Node at Row 0)
  { r: 1, c: 4 }
];

export function LoopTopology() {
  const {
    controllers,
    selectedControllerId,
    selectedModuleId,
    selectedLoopNumber,
    selectedTopologyAddr,
    selectController,
    selectModule,
    selectLoop,
    selectTopologyAddr,
    triggerTopologyAlarm,
    triggerTopologyFault,
    resetTopologyDevice
  } = useFireStore();

  const [activeTab, setActiveTab] = useState<"network" | "physical">("physical");
  
  // Search & Filter state for physical loop view
  const [searchAddr, setSearchAddr] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const currentController = controllers.find((c) => c.id === selectedControllerId);
  const currentModule = currentController?.modules.find((m) => m.id === selectedModuleId);
  const currentLoop = currentModule?.loops.find((l) => l.loopNumber === selectedLoopNumber);

  // Global Statistics
  let globalTotal = 0;
  let globalOnline = 0;
  let globalOffline = 0;
  let globalAlarm = 0;
  let globalFault = 0;

  controllers.forEach((c) => {
    c.modules.forEach((m) => {
      m.loops.forEach((l) => {
        Object.values(l.devices).forEach((d) => {
          globalTotal++;
          if (d.status === "online") globalOnline++;
          else if (d.status === "offline") globalOffline++;
          else if (d.status === "alarm") globalAlarm++;
          else if (d.status === "warning") globalFault++;
        });
      });
    });
  });

  // Loop Specific Statistics
  let loopTotal = 0;
  let loopOnline = 0;
  let loopOffline = 0;
  let loopAlarm = 0;
  let loopFault = 0;

  if (currentLoop) {
    Object.values(currentLoop.devices).forEach((d) => {
      loopTotal++;
      if (d.status === "online") loopOnline++;
      else if (d.status === "offline") loopOffline++;
      else if (d.status === "alarm") loopAlarm++;
      else if (d.status === "warning") loopFault++;
    });
  }

  // Find currently selected topology device
  const selectedDevice =
    currentLoop && selectedTopologyAddr !== undefined
      ? currentLoop.devices[selectedTopologyAddr]
      : undefined;

  // Find any active smoke or temperature detector alarms on the current loop
  const loopFireDevices = currentLoop
    ? Object.values(currentLoop.devices).filter(
        (d) => d.status === "alarm" && (d.type === "smoke" || d.type === "temperature")
      )
    : [];
  const hasLoopFire = loopFireDevices.length > 0;

  // Build matrix cells (7 rows x 5 columns)
  const gridMatrix: (TopologyDevice | undefined)[][] = Array(MAX_ROWS)
    .fill(null)
    .map(() => Array(5).fill(undefined));

  if (currentLoop) {
    const devicesList = Object.values(currentLoop.devices);
    const sortedDevs = [...devicesList].sort((a, b) => a.address - b.address);
    sortedDevs.forEach((dev, idx) => {
      if (idx < SLOTS.length) {
        const slot = SLOTS[idx];
        gridMatrix[slot.r][slot.c] = dev;
      }
    });
  }

  // Determine active branches (columns that contain at least one device on the current loop)
  const activeBranches = [false, false, false, false, false];
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < MAX_ROWS; r++) {
      if (gridMatrix[r][c] !== undefined) {
        activeBranches[c] = true;
      }
    }
  }

  // Calculate the last row index that has a device in each column
  const lastDeviceRowInCol = Array(5).fill(-1);
  for (let c = 0; c < 5; c++) {
    for (let r = MAX_ROWS - 1; r >= 1; r--) {
      if (gridMatrix[r][c] !== undefined) {
        lastDeviceRowInCol[c] = r;
        break;
      }
    }
  }

  // Calculate actual column index mappings in the rendered DOM
  const domColIndex: { [key: number]: number } = {};
  let currentDomIdx = 0;
  for (let c = 0; c < 5; c++) {
    if (activeBranches[c]) {
      domColIndex[c] = currentDomIdx;
      currentDomIdx++;
    }
  }

  // Branch color palette for 5 branches — each branch gets a unique premium color
  const branchColors = [
    { wire: "#4de7ff", glow: "rgba(77,231,255,0.5)",  pulse: "#4de7ff",  shadow: "rgba(77,231,255,0.4)"  }, // Branch 1: cyan
    { wire: "#a78bfa", glow: "rgba(167,139,250,0.5)", pulse: "#c4b5fd",  shadow: "rgba(167,139,250,0.4)" }, // Branch 2: violet
    { wire: "#34d399", glow: "rgba(52,211,153,0.5)",  pulse: "#6ee7b7",  shadow: "rgba(52,211,153,0.4)"  }, // Branch 3: emerald
    { wire: "#fb923c", glow: "rgba(251,146,60,0.5)",  pulse: "#fdba74",  shadow: "rgba(251,146,60,0.4)"  }, // Branch 4: orange
    { wire: "#f472b6", glow: "rgba(244,114,182,0.5)", pulse: "#f9a8d4",  shadow: "rgba(244,114,182,0.4)" }, // Branch 5: pink
  ];

  // 3D Fire Alarm Display Controller Console Panel (Wall Mounted Panel Cabinet)
  function renderNetworkControllerIcon(node: any, isSelected: boolean, hasAlarm: boolean) {
    const cx = node.x;
    const cy = node.y;

    return (
      <g key={`net-ctrl-${node.id}`}>
        <defs>
          <linearGradient id={`net-ctrl-cabinet-${node.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hasAlarm ? "#e63946" : "#ba1c1c"} />
            <stop offset="100%" stopColor={hasAlarm ? "#800a10" : "#5c0808"} />
          </linearGradient>
          <linearGradient id={`net-ctrl-screen-${node.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#03141a" />
            <stop offset="100%" stopColor="#0a2a35" />
          </linearGradient>
        </defs>

        {/* Dynamic Glow Base shadow */}
        <rect
          x={cx - 36}
          y={cy - 30}
          width="72"
          height="60"
          rx="8"
          fill={hasAlarm ? "rgba(255, 77, 94, 0.3)" : (isSelected ? "rgba(5, 230, 255, 0.2)" : "rgba(0, 0, 0, 0.4)")}
          filter="blur(4px)"
        />

        {/* 3D Bevel Edge / Outer Frame (Red Metallic Enclosure) */}
        <rect
          x={cx - 32}
          y={cy - 28}
          width="64"
          height="54"
          rx="6"
          fill={`url(#net-ctrl-cabinet-${node.id})`}
          stroke={hasAlarm ? "#ff6b6b" : (isSelected ? "var(--cyan)" : "#7a0c0c")}
          strokeWidth="2"
          style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}
        />

        {/* Inner Black Control Board Panel */}
        <rect
          x={cx - 27}
          y={cy - 23}
          width="54"
          height="44"
          rx="3"
          fill="#1c1c1c"
          stroke="#333"
          strokeWidth="0.8"
        />

        {/* Large LCD Display Screen */}
        <rect
          x={cx - 23}
          y={cy - 19}
          width="46"
          height="22"
          rx="2"
          fill={`url(#net-ctrl-screen-${node.id})`}
          stroke={hasAlarm ? "#ff4d5e" : "#00e5ff"}
          strokeWidth="1.2"
        />

        {/* Grid lines simulating telemetry monitor screen display */}
        <path d={`M ${cx - 23} ${cy - 8} L ${cx + 23} ${cy - 8}`} stroke="rgba(0, 229, 255, 0.15)" strokeWidth="0.5" />
        <path d={`M ${cx - 10} ${cy - 19} L ${cx - 10} ${cy + 3}`} stroke="rgba(0, 229, 255, 0.15)" strokeWidth="0.5" />

        {/* LCD Screen Display Content: pulsing wave or normal/fire text */}
        {hasAlarm ? (
          <>
            {/* Pulsing Warning Flame/Triangle Graphic in screen */}
            <polygon points={`${cx - 16},${cy - 2} ${cx - 11},${cy - 12} ${cx - 6},${cy - 2}`} fill="#ff4d5e" className="led-flash-alarm" />
            <text x={cx + 7} y={cy - 11} fill="#ff4d5e" fontSize="6.5" fontWeight="bold" textAnchor="middle" className="led-flash-alarm">
              火警!
            </text>
            <text x={cx + 7} y={cy - 2} fill="#ffb300" fontSize="5.5" textAnchor="middle">
              LOOP 1#
            </text>
          </>
        ) : (
          <>
            {/* Telemetry wave line inside screen */}
            <path d={`M ${cx - 21} ${cy - 10} L ${cx - 17} ${cy - 10} L ${cx - 15} ${cy - 15} L ${cx - 12} ${cy - 5} L ${cx - 9} ${cy - 10} L ${cx - 2} ${cy - 10}`} fill="none" stroke="#00ff66" strokeWidth="0.8" />
            <text x={cx + 10} y={cy - 11} fill="#00ff66" fontSize="6.5" fontWeight="bold" textAnchor="middle">
              正常
            </text>
            <text x={cx + 10} y={cy - 2} fill="var(--cyan)" fontSize="5" textAnchor="middle">
              SYS OK
            </text>
          </>
        )}

        {/* LED Status Indicators on Right Side of Control Board */}
        {/* Fire LED (Red) */}
        <circle cx={cx - 20} cy={cy + 13} r="1.8" fill={hasAlarm ? "#ff3b30" : "#4a0b0b"} className={hasAlarm ? "led-flash-alarm" : ""} />
        <rect x={cx - 16} y={cy + 11.5} width="6" height="3" rx="0.5" fill="#555" />
        
        {/* Fault LED (Yellow) */}
        <circle cx={cx - 6} cy={cy + 13} r="1.8" fill="#4a3e0b" />
        <rect x={cx - 2} y={cy + 11.5} width="6" height="3" rx="0.5" fill="#555" />

        {/* Power LED (Green) */}
        <circle cx={cx + 8} cy={cy + 13} r="1.8" fill="#00e676" />
        <rect x={cx + 12} y={cy + 11.5} width="6" height="3" rx="0.5" fill="#555" />

        {/* Small Grey Keyboard buttons at the bottom edge */}
        <rect x={cx - 23} y={cy + 18} width="6" height="2.5" rx="0.5" fill="#555" />
        <rect x={cx - 14} y={cy + 18} width="6" height="2.5" rx="0.5" fill="#555" />
        <rect x={cx - 5} y={cy + 18} width="6" height="2.5" rx="0.5" fill="#555" />
        <rect x={cx + 4} y={cy + 18} width="6" height="2.5" rx="0.5" fill="#555" />
        <rect x={cx + 13} y={cy + 18} width="10" height="2.5" rx="0.5" fill="#3a86ff" />
      </g>
    );
  }

  // 3D LCM Loop Communication Board Module Icon (DIN Rail Industrial LCM Module)
  function renderNetworkModuleIcon(mod: any, modX: number, modY: number, hasAlarm: boolean) {
    const mx = modX;
    const my = modY;
    const gradBody = `net-mod-body-${mod.id}`;

    return (
      <g key={`net-mod-${mod.id}`}>
        <defs>
          <linearGradient id={gradBody} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#303b44" />
            <stop offset="100%" stopColor="#151b20" />
          </linearGradient>
        </defs>

        {/* Shadow */}
        <rect x={mx - 22} y={my - 20} width="44" height="40" rx="3" fill="rgba(0,0,0,0.45)" filter="blur(3px)" />

        {/* DIN Rail metal backplate slider representation */}
        <rect x={mx - 24} y={my - 12} width="48" height="24" rx="2" fill="#7d858c" stroke="#4e5357" strokeWidth="0.8" />
        <line x1={mx - 24} y1={my} x2={mx + 24} y2={my} stroke="#e0e0e0" strokeWidth="1.5" />

        {/* Translucent Dark Graphite Casing */}
        <rect
          x={mx - 19}
          y={my - 17}
          width="38"
          height="34"
          rx="3"
          fill={`url(#${gradBody})`}
          stroke={hasAlarm ? "#ff4d5e" : "#5d6d7e"}
          strokeWidth="1.2"
        />

        {/* Yellow terminal block slots at the top boundary */}
        <rect x={mx - 15} y={my - 22} width="30" height="5" rx="1" fill="#ffb300" stroke="#b37d00" strokeWidth="0.5" />
        <line x1={mx - 10} y1={my - 22} x2={mx - 10} y2={my - 17} stroke="#444" strokeWidth="0.5" />
        <line x1={mx - 5} y1={my - 22} x2={mx - 5} y2={my - 17} stroke="#444" strokeWidth="0.5" />
        <line x1={mx} y1={my - 22} x2={mx} y2={my - 17} stroke="#444" strokeWidth="0.5" />
        <line x1={mx + 5} y1={my - 22} x2={mx + 5} y2={my - 17} stroke="#444" strokeWidth="0.5" />
        <line x1={mx + 10} y1={my - 22} x2={mx + 10} y2={my - 17} stroke="#444" strokeWidth="0.5" />

        {/* Blue terminal block slots at the bottom boundary */}
        <rect x={mx - 15} y={my + 17} width="30" height="5" rx="1" fill="#0077c2" stroke="#004c8c" strokeWidth="0.5" />
        <line x1={mx - 10} y1={my + 17} x2={mx - 10} y2={my + 22} stroke="#444" strokeWidth="0.5" />
        <line x1={mx - 5} y1={my + 17} x2={mx - 5} y2={my + 22} stroke="#444" strokeWidth="0.5" />
        <line x1={mx} y1={my + 17} x2={mx} y2={my + 22} stroke="#444" strokeWidth="0.5" />
        <line x1={mx + 5} y1={my + 17} x2={mx + 5} y2={my + 22} stroke="#444" strokeWidth="0.5" />
        <line x1={mx + 10} y1={my + 17} x2={mx + 10} y2={my + 22} stroke="#444" strokeWidth="0.5" />

        {/* Glowing communication diagnostic LEDs on casing face */}
        <circle cx={mx - 12} cy={my - 6} r="1.5" fill="#00e676" />
        <text x={mx - 8} y={my - 4} fill="#aaa" fontSize="5" textAnchor="start">PWR</text>

        <circle cx={mx - 12} cy={my + 2} r="1.5" fill="#2979ff" className="led-flash-alarm" />
        <text x={mx - 8} y={my + 4} fill="#aaa" fontSize="5" textAnchor="start">COMM</text>

        <circle cx={mx - 12} cy={my + 10} r="1.5" fill={hasAlarm ? "var(--red)" : "rgba(77, 231, 255, 0.4)"} className={hasAlarm ? "led-flash-alarm" : ""} />
        <text x={mx - 8} y={my + 12} fill="#aaa" fontSize="5" textAnchor="start">ERR</text>

        {/* Text Loop Module ID stamp */}
        <rect x={mx + 2} y={my - 6} width="12" height="18" fill="rgba(255,255,255,0.06)" rx="1.5" />
        <text x={mx + 8} y={my + 6} fill="rgba(77, 231, 255, 0.85)" fontSize="6" fontWeight="bold" textAnchor="middle">
          LCM
        </text>
      </g>
    );
  }

  // Render SVG Network Topology (Optimized 800x500 Layout with 3D Icons)
  function renderNetworkSvg() {
    const nodes = [
      { id: "CTRL01", name: "1# 控制器柜", addr: "Addr 01", x: 220, y: 180, status: controllers[0]?.status || "online" },
      { id: "CTRL02", name: "2# 控制器柜", addr: "Addr 02", x: 580, y: 180, status: controllers[1]?.status || "online" },
      { id: "CTRL03", name: "3# 控制器柜", addr: "Addr 03", x: 400, y: 350, status: controllers[2]?.status || "online" }
    ];

    return (
      <div className="network-svg-container" key="net-view-wrapper">
        <svg viewBox="0 0 800 500" className="network-svg" key="net-svg-canvas">
          {/* Ring connections */}
          <path
            d="M 220 180 L 580 180 L 400 350 Z"
            fill="none"
            stroke="rgba(77, 231, 255, 0.25)"
            strokeWidth="3.5"
            strokeDasharray="6,4"
            className="ring-path"
          />
          {/* Pulsing data line along ring */}
          <path
            d="M 220 180 L 580 180 L 400 350 Z"
            fill="none"
            stroke="var(--cyan)"
            strokeWidth="2.5"
            strokeDasharray="20, 200"
            className="pulse-path"
          />

          {/* Draw connection lines to modules if controller is selected */}
          {nodes.map((node) => {
            const isSelected = selectedControllerId === node.id;
            if (!isSelected) return null;

            const ctrlData = controllers.find((c) => c.id === node.id);
            if (!ctrlData) return null;

            return ctrlData.modules.map((mod, mIdx) => {
              // Calculate module X/Y coords based on spacious layout
              let modX = 0;
              let modY = 0;
              if (node.id === "CTRL01") {
                modX = 80;
                modY = mIdx === 0 ? 100 : 260;
              } else if (node.id === "CTRL02") {
                modX = 720;
                modY = mIdx === 0 ? 100 : 260;
              } else { // CTRL03
                modX = mIdx === 0 ? 260 : 540;
                modY = 430;
              }

              return (
                <g key={mod.id} className="module-branch animated">
                  {/* Line from controller to LCM module */}
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={modX}
                    y2={modY}
                    stroke="rgba(77, 231, 255, 0.55)"
                    strokeWidth="2"
                    strokeDasharray="5,3"
                  />
                  
                  {/* 3D LCM Loop Communication Module Node */}
                  {renderNetworkModuleIcon(mod, modX, modY, false)}

                  <text
                    x={modX}
                    y={modY - 26}
                    textAnchor="middle"
                    fill="#eaf6ff"
                    fontSize="10"
                    fontWeight="bold"
                    style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
                  >
                    {mod.name}
                  </text>
                  
                  {/* Draw loop branches */}
                  {mod.loops.map((loop, lIdx) => {
                    // Loop positions arranged to avoid overlaps
                    let loopX = 0;
                    let loopY = 0;
                    if (node.id === "CTRL01") {
                      loopX = lIdx === 0 ? 40 : 120;
                      loopY = mIdx === 0 ? 40 : 320;
                    } else if (node.id === "CTRL02") {
                      loopX = lIdx === 0 ? 680 : 760;
                      loopY = mIdx === 0 ? 40 : 320;
                    } else { // CTRL03
                      loopX = mIdx === 0 ? (lIdx === 0 ? 220 : 300) : (lIdx === 0 ? 500 : 580);
                      loopY = 475;
                    }

                    // Check if any device in this loop has an alarm
                    const hasAlarm = Object.values(loop.devices).some(d => d.status === "alarm");
                    const color = hasAlarm ? "var(--red)" : "var(--green)";

                    return (
                      <g key={loop.loopNumber} className="loop-branch">
                        {/* Connection line LCM -> Loop block */}
                        <line
                          x1={modX}
                          y1={modY}
                          x2={loopX}
                          y2={loopY}
                          stroke="rgba(103, 224, 255, 0.35)"
                          strokeWidth="1.5"
                        />
                        {/* Loop Block */}
                        <rect
                          x={loopX - 25}
                          y={loopY - 8}
                          width="50"
                          height="16"
                          rx="4"
                          fill="rgba(8, 20, 38, 0.95)"
                          stroke={color}
                          strokeWidth="1.5"
                          style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.5))` }}
                        />
                        <text
                          x={loopX}
                          y={loopY + 4}
                          textAnchor="middle"
                          fill="#eaf6ff"
                          fontSize="9"
                          fontWeight="bold"
                        >
                          回路 {loop.loopNumber}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            });
          })}

          {/* Node SVG items for Controllers */}
          {nodes.map((node) => {
            const isSelected = selectedControllerId === node.id;
            const ctrlData = controllers.find((c) => c.id === node.id);
            
            // Check if controller has any alarm devices
            let hasAlarm = false;
            ctrlData?.modules.forEach(m => {
              m.loops.forEach(l => {
                if (Object.values(l.devices).some(d => d.status === "alarm")) {
                  hasAlarm = true;
                }
              });
            });

            return (
              <g
                key={node.id}
                className={`node-group ${isSelected ? "selected" : ""} ${hasAlarm ? "alarm-pulse" : ""}`}
                onClick={() => selectController(node.id)}
                style={{ cursor: "pointer" }}
              >
                {/* 3D Fire Alarm Display Controller Icon */}
                {renderNetworkControllerIcon(node, isSelected, hasAlarm)}

                {/* Controller Text info */}
                <text
                  x={node.x}
                  y={node.y + 40}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="12"
                  fontWeight="bold"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
                >
                  {node.name}
                </text>
                <text
                  x={node.x}
                  y={node.y + 54}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize="10"
                >
                  地址: {node.addr} | {node.status === "online" ? "在线" : "离线"}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="network-legend">
          <h4>网络图示说明</h4>
          <ul>
            <li>
              <span className="dot online" style={{ background: "#ba1c1c" }} />
              <span>火灾报警显示控制器柜面</span>
            </li>
            <li>
              <span className="dot alarm" style={{ background: "#ff4d5e" }} />
              <span>火警报警紧急控制器</span>
            </li>
            <li>
              <span className="dot ring" style={{ background: "#ffcc00" }} />
              <span>LCM 模块通信端子插排</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // Render 250 device addresses in a grid
  function renderAddressGrid() {
    if (!currentLoop) {
      return (
        <div className="grid-empty-state">
          <Info size={32} />
          <p>当前回路无设备配置，请在上方选择正确的控制器与回路</p>
        </div>
      );
    }

    const gridCells = [];
    for (let addr = 1; addr <= 250; addr++) {
      const dev = currentLoop.devices[addr];
      const isSelected = selectedTopologyAddr === addr;

      // Filter logic
      let matchesSearch = true;
      if (searchAddr && !addr.toString().includes(searchAddr) && (!dev || !dev.name.includes(searchAddr))) {
        matchesSearch = false;
      }

      let matchesType = true;
      if (filterType !== "all") {
        if (!dev || dev.type !== filterType) {
          matchesType = false;
        }
      }

      let matchesStatus = true;
      if (filterStatus !== "all") {
        if (filterStatus === "empty") {
          if (dev) matchesStatus = false;
        } else {
          if (!dev || dev.status !== filterStatus) {
            matchesStatus = false;
          }
        }
      }

      const isFilteredOut = !matchesSearch || !matchesType || !matchesStatus;

      let cellClass = "grid-cell";
      if (!dev) {
        cellClass += " cell-empty";
      } else {
        cellClass += ` cell-${dev.status}`;
      }
      if (isSelected) {
        cellClass += " cell-selected";
      }
      if (isFilteredOut) {
        cellClass += " cell-dimmed";
      }

      let symbol = "";
      if (dev) {
        switch (dev.type) {
          case "smoke":
            symbol = "烟";
            break;
          case "temperature":
            symbol = "温";
            break;
          case "manual":
            symbol = "手";
            break;
          case "monitor":
            symbol = "监";
            break;
          case "control":
            symbol = "控";
            break;
        }
      }

      gridCells.push(
        <div
          key={addr}
          className={cellClass}
          onClick={() => selectTopologyAddr(addr)}
          title={
            dev
              ? `地址: ${addr}\n名称: ${dev.name}\n类型: ${dev.type === "smoke" ? "感烟探测器" : dev.type === "temperature" ? "感温探测器" : dev.type === "manual" ? "手动报警按钮" : dev.type === "monitor" ? "监视模块" : "控制模块"}\n状态: ${dev.status}`
              : `地址: ${addr} (空闲未挂载)`
          }
        >
          <span className="cell-number">{addr}</span>
          {dev && <span className="cell-symbol">{symbol}</span>}
        </div>
      );
    }

    return (
      <div className="address-grid-area">
        <div className="grid-section-header first-half">
          <span>烟温探测器挂载区 (地址 1 - 125)</span>
          <span className="muted">前125个用于挂载烟温探测器</span>
        </div>
        <div className="grid-matrix">
          {gridCells.slice(0, 125)}
        </div>

        <div className="grid-section-header second-half">
          <span>消防模块与手报挂载区 (地址 126 - 250)</span>
          <span className="muted">后125个用于挂载手报、监视模块、控制模块</span>
        </div>
        <div className="grid-matrix">
          {gridCells.slice(125, 250)}
        </div>
      </div>
    );
  }

  // Render 3D Stereoscopic SVG Device Icons
  function renderThreeDIcon(type: string, status: DeviceStatus) {
    const isAlarm = status === "alarm";
    const isWarning = status === "warning";
    const isOffline = status === "offline";

    let ledColor = "var(--green)";
    if (isAlarm) ledColor = "var(--red)";
    else if (isWarning) ledColor = "var(--amber)";
    else if (isOffline) ledColor = "rgba(77, 231, 255, 0.4)";

    if (type === "smoke" || type === "temperature") {
      // 3D Spherical/Round detector dome icon
      const radialId = `rad-det-${type}-${status}`;
      return (
        <svg className={`stereoscopic-svg detector-three-d ${status}`} viewBox="0 0 44 44">
          <defs>
            <radialGradient id={radialId} cx="35%" cy="35%" r="65%">
              {isAlarm ? (
                <>
                  <stop offset="0%" stopColor="#ffb3b3" />
                  <stop offset="45%" stopColor="#ff3b30" />
                  <stop offset="100%" stopColor="#6b0303" />
                </>
              ) : isWarning ? (
                <>
                  <stop offset="0%" stopColor="#ffe9b3" />
                  <stop offset="45%" stopColor="#ff9500" />
                  <stop offset="100%" stopColor="#6e3f00" />
                </>
              ) : isOffline ? (
                <>
                  <stop offset="0%" stopColor="#e1f5fe" />
                  <stop offset="45%" stopColor="#b0bec5" />
                  <stop offset="100%" stopColor="#455a64" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="40%" stopColor="#cfd8dc" />
                  <stop offset="100%" stopColor="#455a64" />
                </>
              )}
            </radialGradient>
          </defs>
          <ellipse cx="22" cy="24" rx="18" ry="15" fill="rgba(0,0,0,0.4)" filter="blur(2px)" />
          <circle cx="22" cy="20" r="19" fill="#0c1d33" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
          <circle cx="22" cy="20" r="16" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(103, 224, 255, 0.3)" strokeWidth="0.8" />
          <circle cx="22" cy="20" r="12.5" fill={`url(#${radialId})`} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
          <path d="M 22 10 L 22 12 M 22 28 L 22 30 M 12 20 L 14 20 M 30 20 L 32 20" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="22" cy="20" r="3" fill={ledColor} className={isAlarm ? "led-flash-alarm" : ""} />
        </svg>
      );
    } else if (type === "manual") {
      // 3D Rectangular Pull Station box icon
      const linearId = `lin-man-${status}`;
      return (
        <svg className={`stereoscopic-svg manual-three-d ${status}`} viewBox="0 0 44 44">
          <defs>
            <linearGradient id={linearId} x1="0" y1="0" x2="1" y2="1">
              {isAlarm ? (
                <>
                  <stop offset="0%" stopColor="#ff5e5e" />
                  <stop offset="100%" stopColor="#9e0c0c" />
                </>
              ) : isOffline ? (
                <>
                  <stop offset="0%" stopColor="#b0bec5" />
                  <stop offset="100%" stopColor="#546e7a" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#ff453a" />
                  <stop offset="100%" stopColor="#800909" />
                </>
              )}
            </linearGradient>
          </defs>
          <rect x="5" y="7" width="34" height="30" rx="3" fill="rgba(0,0,0,0.4)" filter="blur(1.5px)" />
          <rect x="5" y="6" width="34" height="29" rx="3" fill="#300303" />
          <rect x="5" y="4" width="34" height="28" rx="3" fill={`url(#${linearId})`} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
          <rect x="10" y="8" width="24" height="12" rx="1.5" fill="#fcfcfc" stroke="#333" strokeWidth="0.5" />
          <path d="M 22 17 C 23.5 17 24 15.5 24 14.5 C 24 13 22.5 11 22 10 C 21.5 11 20 13 20 14.5 C 20 15.5 20.5 17 22 17 Z" fill="#d32f2f" />
          <rect x="8" y="22" width="28" height="3" fill="#ffcc00" rx="0.5" />
          <circle cx="22" cy="27" r="2" fill={ledColor} className={isAlarm ? "led-flash-alarm" : ""} />
        </svg>
      );
    } else {
      // 3D Square/Isometric Module casing icon (CT / CR)
      const isCT = type === "control";
      const blockId = `lin-mod-${type}-${status}`;
      return (
        <svg className={`stereoscopic-svg module-three-d ${status}`} viewBox="0 0 44 44">
          <defs>
            <linearGradient id={blockId} x1="0" y1="0" x2="0" y2="1">
              {isCT ? (
                isOffline ? (
                  <>
                    <stop offset="0%" stopColor="#cfd8dc" />
                    <stop offset="100%" stopColor="#78909c" />
                  </>
                ) : (
                  <>
                    <stop offset="0%" stopColor="#37474f" />
                    <stop offset="100%" stopColor="#212121" />
                  </>
                )
              ) : (
                isOffline ? (
                  <>
                    <stop offset="0%" stopColor="#cfd8dc" />
                    <stop offset="100%" stopColor="#78909c" />
                  </>
                ) : (
                  <>
                    <stop offset="0%" stopColor="#1e3d59" />
                    <stop offset="100%" stopColor="#0f1f2e" />
                  </>
                )
              )}
            </linearGradient>
          </defs>
          <rect x="6" y="8" width="32" height="28" rx="2" fill="rgba(0,0,0,0.5)" filter="blur(1.5px)" />
          <rect x="6" y="7" width="32" height="27" rx="2" fill="#090f1a" />
          <rect
            x="6"
            y="5"
            width="32"
            height="26"
            rx="2"
            fill={`url(#${blockId})`}
            stroke={isCT ? "rgba(255, 149, 0, 0.45)" : "rgba(77, 231, 255, 0.45)"}
            strokeWidth="1"
          />
          <rect x="9" y="2" width="26" height="3.5" fill="#ffb300" rx="0.5" />
          <line x1="14" y1="2" x2="14" y2="5.5" stroke="#424242" strokeWidth="0.5" />
          <line x1="19" y1="2" x2="19" y2="5.5" stroke="#424242" strokeWidth="0.5" />
          <line x1="24" y1="2" x2="24" y2="5.5" stroke="#424242" strokeWidth="0.5" />
          <line x1="29" y1="2" x2="29" y2="5.5" stroke="#424242" strokeWidth="0.5" />

          <text x="22" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff">
            {isCT ? "CT" : "CR"}
          </text>
          
          <circle cx="11" cy="24" r="1.8" fill={ledColor} className={isAlarm ? "led-flash-alarm" : ""} />
        </svg>
      );
    }
  }

  // Render 3D Cabinet SVG representing Parent controller node (Wall Console Cabinet)
  function renderParentCabinetIcon() {
    return (
      <svg className="stereoscopic-svg parent-cabinet-svg" viewBox="0 0 50 50" style={{ width: "48px", height: "48px" }}>
        <defs>
          <linearGradient id="grad-parent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4d5d" />
            <stop offset="100%" stopColor="#b3101d" />
          </linearGradient>
        </defs>
        <rect x="5" y="5" width="40" height="40" rx="5" fill="#1f1f1f" stroke="url(#grad-parent)" strokeWidth="2.5" />
        <rect x="9" y="9" width="32" height="18" rx="2" fill="#03141a" stroke="#00e5ff" strokeWidth="1" />
        <circle cx="14" cy="14" r="1" fill="#00ff66" />
        <path d="M 17 14 L 37 14" stroke="#00e5ff" strokeWidth="0.5" strokeDasharray="2,2" />
        <circle cx="14" cy="20" r="1" fill="#ff3b30" className="led-flash-alarm" />
        <circle cx="15" cy="35" r="2" fill="#ffcc00" />
        <circle cx="25" cy="35" r="2" fill="#00ff66" />
        <circle cx="35" cy="35" r="2" fill="#00e5ff" />
      </svg>
    );
  }

  /**
   * Renders an orthogonal 90-degree T-junction branching wire matching the hand-drawn diagram.
   * Features a stable key to prevent DOM recreation and flickering during ticks.
   */
  function renderOrthogonalBranchSVG(
    colSpan: number,
    srcColor: typeof branchColors[0],
    tgtColor: typeof branchColors[0],
    delayStr: string,
    key: string
  ) {
    const totalCols = colSpan + 1;
    const svgWidth  = totalCols * 100;
    const srcCenterX = 50;                   // Center X of source column in SVG coords
    const tgtCenterX = colSpan * 100 + 50;   // Center X of target column in SVG coords
    const midY  = 50;                         // MIDPOINT of source cell height — on the vertical wire between two nodes
    const endY  = 200;                        // Off-screen bottom — reaches top of next row

    // Full path: T-junction mid-cell → horizontal right → 90° down into next row
    const pathD = `M ${srcCenterX} ${midY} L ${tgtCenterX} ${midY} L ${tgtCenterX} ${endY}`;

    // Unique IDs for defs
    const gradId   = `bg-${srcColor.wire.slice(1)}-${tgtColor.wire.slice(1)}`;
    const glowId   = `gg-${tgtColor.wire.slice(1)}`;

    return (
      <svg
        key={key}
        className="curved-branch-svg"
        viewBox={`0 0 ${svgWidth} ${endY}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width:  `${totalCols * 100}%`,
          height: "200%",          // 200% of cell height so the vertical leg visually enters the next row
          pointerEvents: "none",
          zIndex: 3,
          overflow: "visible"
        }}
      >
        <defs>
          {/* Gradient transitioning from source branch color to target branch color */}
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor={srcColor.wire} />
            <stop offset="100%" stopColor={tgtColor.wire} />
          </linearGradient>
          {/* Glow filter for the target-side wire */}
          <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ─── Layer 1: wide outer glow / shadow ─── */}
        <path d={pathD} fill="none"
          stroke={tgtColor.shadow} strokeWidth="10"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.3"
        />

        {/* ─── Layer 2: main gradient wire ─── */}
        <path d={pathD} fill="none"
          stroke={`url(#${gradId})`} strokeWidth="4"
          strokeLinecap="round" strokeLinejoin="round"
          filter={`url(#${glowId})`}
        />

        {/* ─── Layer 3: inner specular highlight ─── */}
        <path d={pathD} fill="none"
          stroke="rgba(255,255,255,0.4)" strokeWidth="1.2"
          strokeLinecap="round" strokeLinejoin="round"
        />

        {/* ─── T-junction marker: glowing circle ON the source vertical wire ─── */}
        <circle
          cx={srcCenterX} cy={midY} r="6"
          fill={srcColor.wire}
          style={{ filter: `drop-shadow(0 0 6px ${srcColor.wire}) drop-shadow(0 0 12px ${srcColor.wire})` }}
        />
        {/* Inner bright core */}
        <circle cx={srcCenterX} cy={midY} r="3" fill="white" opacity="0.85" />

        {/* ─── Corner bend marker at 90° turn point ─── */}
        <circle
          cx={tgtCenterX} cy={midY} r="5"
          fill={tgtColor.wire}
          style={{ filter: `drop-shadow(0 0 5px ${tgtColor.wire})` }}
        />
        <circle cx={tgtCenterX} cy={midY} r="2.5" fill="white" opacity="0.75" />

        {/* ─── Pulsing signal dot flowing along the L-path ─── */}
        <circle r="5.5" fill={tgtColor.pulse} opacity="0.9"
          style={{ filter: `drop-shadow(0 0 8px ${tgtColor.wire})` }}
        >
          <animateMotion path={pathD} dur="2.4s" repeatCount="indefinite" begin={delayStr} />
        </circle>
      </svg>
    );
  }

  /**
   * Renders the thick vertical main wire for a branch column.
   * If it is the last device in the column, we only draw a half-height wire
   * (from y=0 top of cell to y=50 center of device) and terminate the pulsing dot there.
   */
  function renderVerticalWire(
    colIdx: number,
    devStatus: string | null,
    flowDelay: string,
    key: string,
    isLastDevice: boolean
  ) {
    const color = branchColors[colIdx] || branchColors[0];
    const wireColor = devStatus === "alarm" ? "#ff4d5e" : color.wire;
    const glowColor = devStatus === "alarm" ? "rgba(255,77,94,0.5)" : color.glow;

    // Last device has wire running only to the center (height=50), others run full cell (height=100)
    const wireHeight = isLastDevice ? 50 : 100;

    return (
      <div className="vertical-wire-route-styled" key={key}>
        <svg
          viewBox="0 0 20 100"
          style={{ width: "20px", height: "100%", position: "absolute", left: "50%", transform: "translateX(-50%)", top: 0 }}
        >
          <defs>
            <linearGradient id={`vwire-${colIdx}-${devStatus}-${isLastDevice}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={wireColor} stopOpacity="0.7" />
              <stop offset="50%" stopColor={wireColor} stopOpacity="1" />
              <stop offset="100%" stopColor={wireColor} stopOpacity="0.7" />
            </linearGradient>
          </defs>
          {/* Outer glow track */}
          <rect x="7" y="0" width="6" height={wireHeight} rx="3" fill={glowColor} opacity="0.3" />
          {/* Main colored pipe */}
          <rect x="8" y="0" width="4" height={wireHeight} rx="2" fill={`url(#vwire-${colIdx}-${devStatus}-${isLastDevice})`} />
          {/* Bright specular center line */}
          <rect x="9.2" y="0" width="1.6" height={wireHeight} rx="0.8" fill="rgba(255,255,255,0.25)" />
        </svg>
        {/* Animated pulse dot */}
        <div
          className={`vertical-pulse-dot-styled ${devStatus || "empty"}`}
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: wireColor,
            boxShadow: `0 0 8px 2px ${wireColor}`,
            animation: isLastDevice ? "pulseDownToHalf 2s linear infinite" : "pulseDown 2s linear infinite",
            animationDelay: flowDelay,
            zIndex: 2,
            top: 0
          }}
        />
      </div>
    );
  }

  return (
    <div className="loop-topology-container">
      {/* Global stats bar showing total, online, offline, alarm, fault (warning) */}
      <div className="topology-stats-grid">
        <div className="stat-card">
          <div className="stat-icon cyan">
            <Network size={20} />
          </div>
          <div>
            <span>总的回路设备数量</span>
            <strong>{globalTotal} <small>个点位</small></strong>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span>总的回路设备在线</span>
            <strong>{globalOnline} <small>点在线</small></strong>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon red animate-pulse">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span>总的回路设备报警</span>
            <strong className={globalAlarm > 0 ? "text-alarm" : ""}>{globalAlarm}</strong>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon violet">
            <Activity size={20} />
          </div>
          <div>
            <span>总的回路设备故障</span>
            <strong>{globalFault} <small>个故障</small></strong>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon offline">
            <WifiOff size={20} />
          </div>
          <div>
            <span>总的回路设备离线</span>
            <strong className={globalOffline > 0 ? "text-cyan" : ""}>{globalOffline}</strong>
          </div>
        </div>
      </div>

      <div className="topology-tabs">
        <button
          className={activeTab === "network" ? "active" : ""}
          onClick={() => setActiveTab("network")}
        >
          <Network size={16} />
          <span>控制器网络拓扑图</span>
        </button>
        <button
          className={activeTab === "physical" ? "active" : ""}
          onClick={() => setActiveTab("physical")}
        >
          <Sliders size={16} />
          <span>回路物理地址拓扑</span>
        </button>
      </div>

      <div className="tab-pane-content">
        {activeTab === "network" ? (
          <div className="network-tab-view" key="net-tab-wrapper">
            <div className="view-sidebar">
              <div className="panel-box">
                <div className="panel-hdr">
                  <Terminal size={15} />
                  <span>控制器快速浏览</span>
                </div>
                <div className="ctrl-list">
                  {controllers.map((ctrl) => {
                    const isSelected = selectedControllerId === ctrl.id;
                    const cAlarms: any[] = [];
                    ctrl.modules.forEach(m => m.loops.forEach(l => Object.values(l.devices).forEach(d => {
                      if (d.status === "alarm") cAlarms.push(d);
                    })));

                    return (
                      <button
                        key={ctrl.id}
                        className={`ctrl-item ${isSelected ? "selected" : ""}`}
                        onClick={() => selectController(ctrl.id)}
                      >
                        <div className="ctrl-info">
                          <strong>{ctrl.name}</strong>
                          <span>控制器地址: {ctrl.address}</span>
                        </div>
                        <div className="ctrl-badges">
                          {cAlarms.length > 0 && <span className="alarm-badge">{cAlarms.length} 火警</span>}
                          <span className={`status-badge ${ctrl.status}`}>
                            {ctrl.status === "online" ? "在线" : "故障"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {currentController && (
                <div className="panel-box detail-box">
                  <div className="panel-hdr">
                    <Info size={15} />
                    <span>控制器柜参数档案</span>
                  </div>
                  <table className="info-table">
                    <tbody>
                      <tr>
                        <td>机柜名称:</td>
                        <td>{currentController.name}</td>
                      </tr>
                      <tr>
                        <td>控制器地址:</td>
                        <td>{currentController.address} 号机柜</td>
                      </tr>
                      <tr>
                        <td>LCM 通信板数:</td>
                        <td>{currentController.modules.length} 块LCM板</td>
                      </tr>
                      <tr>
                        <td>通信状态:</td>
                        <td className={currentController.status === "online" ? "text-green" : "text-red"}>
                          {currentController.status === "online" ? "工业以太网在线" : "通信离线"}
                        </td>
                      </tr>
                      <tr>
                        <td>协议规格:</td>
                        <td>GB 16806-2006</td>
                      </tr>
                      <tr>
                        <td>机柜位置:</td>
                        <td>一楼消防控制中心柜</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="action-hint">
                    <Info size={13} />
                    <span>提示：点击网络图中的机柜图标可动态切换选中的控制器并展开下辖 LCM 模块分支</span>
                  </div>
                </div>
              )}
            </div>

            <div className="view-canvas">
              <div className="canvas-header">
                <h3>火灾报警显示控制器柜组连接网络图</h3>
                <span className="muted">层级关系: 3D控制器柜 -- 3D LCM回路板 -- 混合拓扑回路号</span>
              </div>
              {renderNetworkSvg()}
            </div>
          </div>
        ) : (
          <div className="physical-tab-view" key="phys-tab-wrapper">
            <div className="physical-toolbar">
              <div className="selector-group">
                <div className="select-item">
                  <label>控制器</label>
                  <select
                    value={selectedControllerId}
                    onChange={(e) => selectController(e.target.value)}
                  >
                    {controllers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="select-item">
                  <label>回路通信控制模块</label>
                  <select
                    value={selectedModuleId}
                    onChange={(e) => selectModule(e.target.value)}
                  >
                    {currentController?.modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.index}#)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="select-item">
                  <label>回路号</label>
                  <select
                    value={selectedLoopNumber}
                    onChange={(e) => selectLoop(Number(e.target.value))}
                  >
                    {currentModule?.loops.map((l) => (
                      <option key={l.loopNumber} value={l.loopNumber}>
                        第 {l.loopNumber} 回路
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Loop Specific Statistics Strip */}
              <div className="loop-stats-strip">
                <div className="strip-title">
                  <strong>第 {selectedLoopNumber} 回路数据：</strong>
                </div>
                <div className="strip-badge total">
                  <span>总数</span>
                  <strong>{loopTotal}</strong>
                </div>
                <div className="strip-badge online">
                  <span>在线</span>
                  <strong>{loopOnline}</strong>
                </div>
                <div className="strip-badge alarm">
                  <span>报警</span>
                  <strong>{loopAlarm}</strong>
                </div>
                <div className="strip-badge fault">
                  <span>故障</span>
                  <strong>{loopFault}</strong>
                </div>
                <div className="strip-badge offline">
                  <span>离线</span>
                  <strong>{loopOffline}</strong>
                </div>
              </div>

              <div className="filter-group">
                <div className="search-box">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="输入设备地址或名称查询..."
                    value={searchAddr}
                    onChange={(e) => setSearchAddr(e.target.value)}
                  />
                </div>

                <div className="select-item select-horizontal">
                  <label>设备类型</label>
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option value="all">全部类型</option>
                    <option value="smoke">感烟探测器</option>
                    <option value="temperature">感温探测器</option>
                    <option value="manual">手动报警按钮</option>
                    <option value="monitor">监视模块</option>
                    <option value="control">控制模块</option>
                  </select>
                </div>

                <div className="select-item select-horizontal">
                  <label>状态</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="all">全部状态</option>
                    <option value="online">正常在线</option>
                    <option value="alarm">火警触发</option>
                    <option value="warning">预警状态</option>
                    <option value="offline">通信故障</option>
                    <option value="empty">空闲未配置</option>
                  </select>
                </div>
              </div>
            </div>

            {/* High-visibility Urgent Fire Alarm Command Banner (Smoke & Temp Detectors) */}
            {hasLoopFire && (
              <div className="emergency-fire-banner animate-pulse-glow">
                <div className="emergency-header">
                  <div className="fire-alert-icon">🔥</div>
                  <div className="fire-alert-text">
                    <h3>消防应急中心火灾警告 (DETECTOR FIRE ALARM)</h3>
                    <p>检测到回路探测器触发红色最高级火警！请立即确认并执行应急响应流！</p>
                  </div>
                </div>

                {/* Animated CSS Fire Flame element */}
                <div className="fire-flame-panel">
                  <div className="flame-particle p1" />
                  <div className="flame-particle p2" />
                  <div className="flame-particle p3" />
                  <div className="flame-particle p4" />
                </div>

                <div className="alarm-locations-list">
                  <strong>触发火警点位物理位置：</strong>
                  {loopFireDevices.map((dev) => (
                    <div key={dev.address} className="alarm-location-item">
                      <span className="loc-text">
                        [{dev.type === "smoke" ? "烟感火警" : "温感火警"}] 地址 #{dev.address} - {dev.location || "配电间区域"} ({dev.name})
                      </span>
                      <button
                        className="quick-locate-btn"
                        onClick={() => selectTopologyAddr(dev.address)}
                      >
                        定位设备点位
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Enlarged Vertical Table-based Loop Wiring Branches Topology */}
            <div className="loop-connection-diagram vertical-expanded">
              <div className="diagram-hdr">
                <div className="indicator">
                  <Activity size={16} className="icon-pulse text-cyan" />
                  <strong style={{ fontSize: "14px" }}>回路树形分支布线接线连接图 (直角90度分流实际安装拓扑)</strong>
                </div>
                <span className="muted">分支敷设规则：直角90度分线接线，仅渲染存在设备的分支线路</span>
              </div>
              
              <div className="table-branch-wrapper" key="topology-table-scroller">
                <table className="branch-topology-table">
                  <thead>
                    <tr>
                      <th className="row-index-header">安装顺序 / 物理位置</th>
                      {BRANCH_NAMES.map((name, idx) => {
                        if (!activeBranches[idx]) return null;
                        return (
                          <th key={idx} className="branch-col-header">
                            <div className="branch-header-content">
                              <span className="branch-code">分支 #{idx + 1}</span>
                              <span className="branch-name">{name}</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* HUB connection row at the very top (Parent node: 控制器) */}
                    <tr className="hub-row" key="hub-row-parent">
                      <td className="row-index-cell hub-label">主控机柜出线</td>
                      
                      {/* Column 0: Root Controller Out station (Simplified with 3D Cabinet Icon) */}
                      {/* Branch 3 (col 2) & Branch 5 (col 4) orthogonal wires are rendered inside col 0 (source),
                          starting from bottom-center of the hub cell, going right then down */}
                      <td className="branch-cell-path parent-node-cell" style={{ position: "relative" }}>
                        {/* Hub-to-Branch3 orthogonal wire (rendered in source col 0) */}
                        {activeBranches[2] && (() => {
                          const colSpan = domColIndex[2] - domColIndex[0];
                          return renderOrthogonalBranchSVG(colSpan, branchColors[0], branchColors[2], "0.2s", "hub-split-b3");
                        })()}
                        {/* Hub-to-Branch5 orthogonal wire (rendered in source col 0) */}
                        {activeBranches[4] && (() => {
                          const colSpan = domColIndex[4] - domColIndex[0];
                          return renderOrthogonalBranchSVG(colSpan, branchColors[0], branchColors[4], "0.4s", "hub-split-b5");
                        })()}

                        <div className="vertical-wire-route root-wire" />
                        <div className="table-flow-node root-station-node" onClick={() => selectTopologyAddr(undefined)}>
                          <div className="root-station-layout">
                            <div className="parent-cabinet-wrapper">
                              {renderParentCabinetIcon()}
                            </div>
                            <div className="parent-cabinet-meta">
                              <span className="parent-label">回路源头</span>
                              <strong>1# 控制器柜</strong>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Render remaining columns in Row 0 (col 1, 2, 3, 4) — no wires here since they originate in col 0 */}
                      {BRANCH_NAMES.map((_, colIdx) => {
                        if (colIdx === 0 || !activeBranches[colIdx]) return null;
                        return (
                          <td key={colIdx} className="branch-cell-path cell-empty-wire">
                            {/* Wire enters from above (drawn in prev col) — show receiving connector dot */}
                            {(colIdx === 2 || colIdx === 4) && (
                              <div className="empty-wire-connector" key={`hub-empty-${colIdx}`}>
                                <div className="connector-dot" style={{ background: branchColors[colIdx].wire, boxShadow: `0 0 6px ${branchColors[colIdx].wire}` }} />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Positions 1 to 6 on each branch */}
                    {Array(MAX_ROWS)
                      .fill(null)
                      .map((_, rowIdx) => {
                        // Skip rowIdx === 0 since Row 0 is the Hub/Parent row
                        if (rowIdx === 0) return null;

                        return (
                          <tr key={rowIdx}>
                            {/* Left Row Header showing position */}
                            <td className="row-index-cell">
                              <div className="pos-badge">第 {rowIdx} 级安装节点</div>
                            </td>

                            {/* Dynamic Columns (Branches) */}
                            {BRANCH_NAMES.map((_, colIdx) => {
                              if (!activeBranches[colIdx]) return null;

                              const dev = gridMatrix[rowIdx][colIdx];
                              const isSelected = dev ? selectedTopologyAddr === dev.address : false;

                              // Filter flags check
                              let matchesSearch = true;
                              if (dev && searchAddr && !dev.address.toString().includes(searchAddr) && !dev.name.includes(searchAddr)) {
                                matchesSearch = false;
                              }
                              let matchesType = true;
                              if (dev && filterType !== "all" && dev.type !== filterType) {
                                matchesType = false;
                              }
                              let matchesStatus = true;
                              if (dev && filterStatus !== "all" && dev.status !== filterStatus) {
                                matchesStatus = false;
                              }
                              const isFilteredOut = dev && (!matchesSearch || !matchesType || !matchesStatus);

                              // Branch wire logic rules:
                              // We only draw wires up to the last configured device in the column!
                              const startRow = colIdx === 1 ? 2 : (colIdx === 3 ? 3 : 1);
                              const lastRow = lastDeviceRowInCol[colIdx];
                              
                              // We only render vertical wires if the current row is within the active device range
                              const hasVerticalWire = 
                                lastRow !== -1 && 
                                rowIdx >= startRow && 
                                rowIdx <= lastRow;

                              // If it is the last device row in this column, we only draw a half-height wire
                              const isLastDevice = rowIdx === lastRow;

                              // Branch 2 split: rendered in SOURCE column (col 0) at row 1.
                              // The wire starts at the BOTTOM of this cell (between node 1 and node 2 of Branch 1),
                              // goes horizontal to Branch 2 column, then turns 90° down.
                              const isBranch2SplitSource = rowIdx === 1 && colIdx === 0 && activeBranches[1];

                              // Branch 4 split: rendered in SOURCE column (col 2) at row 2.
                              // Wire starts at bottom of this cell (between node 2 and 3 of Branch 3),
                              // goes horizontal to Branch 4 column, then turns 90° down.
                              const isBranch4SplitSource = rowIdx === 2 && colIdx === 2 && activeBranches[3];

                              // Cascade animation delays for pulsing dot in standard vertical lines
                              let flowDelay = "0s";
                              if (colIdx === 0) {
                                flowDelay = `${rowIdx * 0.45}s`;
                              } else if (colIdx === 1 && rowIdx >= 2) {
                                flowDelay = `${1.05 + (rowIdx - 1) * 0.45}s`;
                              } else if (colIdx === 2) {
                                flowDelay = `${0.2 + rowIdx * 0.45}s`;
                              } else if (colIdx === 3 && rowIdx >= 3) {
                                flowDelay = `${1.7 + (rowIdx - 2) * 0.45}s`;
                              } else if (colIdx === 4 && rowIdx === 1) {
                                flowDelay = `${0.4 + 0.45}s`;
                              }

                              return (
                                <td key={colIdx} className="branch-cell-path" style={{ position: "relative" }}>
                                  {/* Render thick colored vertical wire with stable keys and half-height check */}
                                  {hasVerticalWire && renderVerticalWire(
                                    colIdx,
                                    dev?.status || null,
                                    flowDelay,
                                    `vwire-${rowIdx}-${colIdx}`,
                                    isLastDevice
                                  )}

                                  {/* Branch 2 split: SOURCE is col 0, row 1 — wire departs from bottom-center of this cell */}
                                  {isBranch2SplitSource && (
                                    renderOrthogonalBranchSVG(
                                      domColIndex[1] - domColIndex[0],
                                      branchColors[0],
                                      branchColors[1],
                                      "1.05s",
                                      `split-b2-${rowIdx}`
                                    )
                                  )}

                                  {/* Branch 4 split: SOURCE is col 2, row 2 — wire departs from bottom-center of this cell */}
                                  {isBranch4SplitSource && (
                                    renderOrthogonalBranchSVG(
                                      domColIndex[3] - domColIndex[2],
                                      branchColors[2],
                                      branchColors[3],
                                      "1.70s",
                                      `split-b4-${rowIdx}`
                                    )
                                  )}

                                  {dev ? (
                                    <div
                                      key={`dev-card-${dev.id}`}
                                      className={`table-flow-node three-d-node node-${dev.status} ${isSelected ? "selected" : ""} ${isFilteredOut ? "dimmed" : ""} ${dev.status === "alarm" && (dev.type === "smoke" || dev.type === "temperature") ? "smoke-alarm-flash" : ""}`}
                                      onClick={() => selectTopologyAddr(dev.address)}
                                    >
                                      <div className="node-layout-three-d">
                                        {/* Stereoscopic Icon Area */}
                                        <div className="icon-wrapper-three-d">
                                          {renderThreeDIcon(dev.type, dev.status)}
                                        </div>
                                        {/* Metadata Area */}
                                        <div className="node-meta-three-d">
                                          <span className="node-addr-tag-three-d">#{dev.address}</span>
                                          <div className="node-label-title-three-d">{dev.name.split(" ").pop()}</div>
                                          <div className="node-type-tag-three-d">
                                            {dev.type === "smoke" && "感烟探测器"}
                                            {dev.type === "temperature" && "感温探测器"}
                                            {dev.type === "manual" && "手动按钮"}
                                            {dev.type === "monitor" && "监视模块(CR)"}
                                            {dev.type === "control" && "控制模块(CT)"}
                                          </div>
                                          {dev.value !== undefined && (
                                            <div className="node-val-display-three-d">
                                              {dev.value} <small>{dev.unit}</small>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Tooltip Box for Brief Info on Hover / Click */}
                                      <div className="tooltip-brief-info">
                                        <div className="tooltip-title">
                                          <span className="tooltip-addr">地址 #{dev.address}</span>
                                          <span className="tooltip-type-label">
                                            {dev.type === "smoke" && "感烟探测器"}
                                            {dev.type === "temperature" && "感温探测器"}
                                            {dev.type === "manual" && "手动按钮"}
                                            {dev.type === "monitor" && "监视模块(CR)"}
                                            {dev.type === "control" && "控制模块(CT)"}
                                          </span>
                                        </div>
                                        <div className="tooltip-row">
                                          <span>设备状态：</span>
                                          <span className={`tooltip-status-val text-${dev.status}`}>
                                            {dev.status === "online" && "正常在线"}
                                            {dev.status === "alarm" && "火警触发"}
                                            {dev.status === "warning" && "数值预警"}
                                            {dev.status === "offline" && "通信故障"}
                                          </span>
                                        </div>
                                        {dev.value !== undefined && (
                                          <div className="tooltip-row">
                                            <span>当前数值：</span>
                                            <span className="tooltip-value-val">{dev.value} {dev.unit}</span>
                                          </div>
                                        )}
                                        <div className="tooltip-row tooltip-loc">
                                          <span>位置：</span>
                                          <span>{dev.location?.split(" - ").slice(0, 2).join(" · ") || "配电间"}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    // Render empty wire connector node
                                    hasVerticalWire && !isLastDevice && (
                                      <div className="empty-wire-connector" key={`empty-conn-${rowIdx}-${colIdx}`}>
                                        <div className="connector-dot" />
                                      </div>
                                    )
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="physical-layout">
              <div className="physical-grid-container">
                {renderAddressGrid()}

                <div className="grid-legend">
                  <div className="legend-item">
                    <span className="legend-color empty" />
                    <span>空闲未配置</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color online" />
                    <span>正常在线 (检测中)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color alarm" />
                    <span>火灾报警 (ALARM)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color warning" />
                    <span>数值预警 (WARNING)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color offline" />
                    <span>通信故障 (OFFLINE)</span>
                  </div>
                </div>
              </div>

              <div className="physical-details-panel">
                {selectedDevice ? (
                  <div className="detail-panel-inner">
                    <div className="panel-title-bar">
                      <h4>回路设备详情 (ADDR #{selectedTopologyAddr})</h4>
                      <span className={`status-tag ${selectedDevice.status}`}>
                        {selectedDevice.status === "online" && "正常在线"}
                        {selectedDevice.status === "alarm" && "火灾报警"}
                        {selectedDevice.status === "warning" && "数值预警"}
                        {selectedDevice.status === "offline" && "通信故障"}
                      </span>
                    </div>

                    <div className="detail-content">
                      <table className="info-table">
                        <tbody>
                          <tr>
                            <td>系统编码 ID:</td>
                            <td className="monospace">{selectedDevice.id}</td>
                          </tr>
                          <tr>
                            <td>点位名称:</td>
                            <td>{selectedDevice.name}</td>
                          </tr>
                          <tr>
                            <td>回路内地址:</td>
                            <td>{selectedDevice.address} 号地址</td>
                          </tr>
                          <tr>
                            <td>设备序列号 (SN):</td>
                            <td className="monospace text-cyan">{selectedDevice.serialNumber || "SN-0100100412"}</td>
                          </tr>
                          <tr>
                            <td>报警状态:</td>
                            <td>
                              {selectedDevice.status === "online" && <span className="text-green">● 正常监视状态 (在线)</span>}
                              {selectedDevice.status === "alarm" && <span className="text-alarm animate-pulse">▲ 火灾高危报警 (火警)</span>}
                              {selectedDevice.status === "warning" && <span className="text-warning">◆ 数值预警/故障警告</span>}
                              {selectedDevice.status === "offline" && <span className="text-muted">○ 物理断路/通信故障 (离线)</span>}
                            </td>
                          </tr>
                          <tr>
                            <td>设备个性代码:</td>
                            <td className="monospace">{selectedDevice.personalityCode || `PC-CODE-${selectedDevice.address}`}</td>
                          </tr>
                          <tr>
                            <td>物理布置位置:</td>
                            <td className="text-cyan font-bold">{selectedDevice.location || "3F - 北侧配电间第4区"}</td>
                          </tr>
                          {selectedDevice.value !== undefined && (
                            <tr>
                              <td>监测遥测数值:</td>
                              <td className="telemetry-value">
                                <span>{selectedDevice.value}</span>
                                <small>{selectedDevice.unit}</small>
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td>最近巡检更新:</td>
                            <td>{selectedDevice.lastSeen ? new Date(selectedDevice.lastSeen).toLocaleTimeString() : "无记录"}</td>
                          </tr>
                          <tr>
                            <td>所属控制器拓扑:</td>
                            <td>{currentController?.name} (出线端 {currentController?.address}) &gt; {currentModule?.name} &gt; 第 {selectedLoopNumber} 回路</td>
                          </tr>
                        </tbody>
                      </table>

                      <div className="simulation-actions-box">
                        <h5>
                          <Terminal size={14} />
                          现场设备模拟控制台
                        </h5>
                        <p className="muted">通过模拟测试按键，可以在该回路节点注入告警或物理断路，验证 system 应急响应流：</p>
                        
                        <div className="sim-buttons">
                          <button
                            className="sim-btn alarm"
                            onClick={() =>
                              triggerTopologyAlarm(
                                selectedControllerId!,
                                selectedModuleId!,
                                selectedLoopNumber!,
                                selectedTopologyAddr!
                              )
                            }
                          >
                            <AlertTriangle size={15} />
                            模拟火警触发
                          </button>
                          <button
                            className="sim-btn fault"
                            onClick={() =>
                              triggerTopologyFault(
                                selectedControllerId!,
                                selectedModuleId!,
                                selectedLoopNumber!,
                                selectedTopologyAddr!
                              )
                            }
                          >
                            <WifiOff size={15} />
                            模拟通信故障
                          </button>
                          <button
                            className="sim-btn reset"
                            onClick={() =>
                              resetTopologyDevice(
                                selectedControllerId!,
                                selectedModuleId!,
                                selectedLoopNumber!,
                                selectedTopologyAddr!
                              )
                            }
                          >
                            <RefreshCw size={15} />
                            消音复位信号
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-selection-panel">
                    <Info size={28} />
                    <strong>未选中回路设备</strong>
                    <p className="muted">
                      {selectedTopologyAddr !== undefined
                        ? `回路物理地址 ${selectedTopologyAddr} 目前属于未配置状态。${selectedTopologyAddr <= 125 ? "此地址为前125号烟温探测器区。" : "此地址为后125号手报与模块区。"}`
                        : "请在左侧 1 - 250 回路设备物理矩阵或上方的垂直分支布线表点击任意设备节点，以激活此控制台。"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
