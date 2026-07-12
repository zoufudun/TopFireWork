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

  // Grid definition according to hand-drawn drawing:
  // Row 0: Controller Parent row (Hub)
  // Columns 0 to 4 represent Branch 1 to Branch 5
  const maxRows = 7; // Rows 0 to 6
  const branchNames = [
    "分支一 (主干电缆干线)",
    "分支二 (由分支一节点间引出)",
    "分支三 (并联电缆干线 A)",
    "分支四 (由分支三节点间引出)",
    "分支五 (并联电缆干线 B)"
  ];

  // Grid slots mapping (r: row index 1-6, c: col index 0-4)
  const slots = [
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
    { r: 5, c: 2 },
    { r: 6, c: 2 },

    // Column 3 (Branch 4): Rows 3, 4, 5 (splits between Row 2 and Row 3 of Branch 3)
    { r: 3, c: 3 },
    { r: 4, c: 3 },
    { r: 5, c: 3 },

    // Column 4 (Branch 5): Row 1 (splits from Parent Node at Row 0)
    { r: 1, c: 4 }
  ];

  // Build matrix cells (7 rows x 5 columns)
  const gridMatrix: (TopologyDevice | undefined)[][] = Array(maxRows)
    .fill(null)
    .map(() => Array(5).fill(undefined));

  if (currentLoop) {
    const devicesList = Object.values(currentLoop.devices);
    const sortedDevs = [...devicesList].sort((a, b) => a.address - b.address);
    sortedDevs.forEach((dev, idx) => {
      if (idx < slots.length) {
        const slot = slots[idx];
        gridMatrix[slot.r][slot.c] = dev;
      }
    });
  }

  // Render SVG Network Topology
  function renderNetworkSvg() {
    const nodes = [
      { id: "CTRL01", name: "1# 控制器", addr: "Addr 01", x: 150, y: 120, status: controllers[0]?.status || "online" },
      { id: "CTRL02", name: "2# 控制器", addr: "Addr 02", x: 450, y: 120, status: controllers[1]?.status || "online" },
      { id: "CTRL03", name: "3# 控制器", addr: "Addr 03", x: 300, y: 320, status: controllers[2]?.status || "online" }
    ];

    return (
      <div className="network-svg-container">
        <svg viewBox="0 0 600 420" className="network-svg">
          {/* Ring connections */}
          <path
            d="M 150 120 L 450 120 L 300 320 Z"
            fill="none"
            stroke="rgba(77, 231, 255, 0.25)"
            strokeWidth="3"
            strokeDasharray="6,4"
            className="ring-path"
          />
          {/* Pulsing data line along ring */}
          <path
            d="M 150 120 L 450 120 L 300 320 Z"
            fill="none"
            stroke="var(--cyan)"
            strokeWidth="2"
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
              const modX = node.x + (mIdx === 0 ? -120 : 120) * (node.id === "CTRL03" ? 0.7 : 1);
              const modY = node.y + (node.id === "CTRL03" ? 80 : -70);

              return (
                <g key={mod.id} className="module-branch animated">
                  {/* Line to module */}
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={modX}
                    y2={modY}
                    stroke="rgba(77, 231, 255, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="4,2"
                  />
                  {/* Module node */}
                  <circle
                    cx={modX}
                    cy={modY}
                    r="8"
                    fill="rgba(5, 11, 22, 0.9)"
                    stroke="var(--cyan)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={modX}
                    y={modY - 14}
                    textAnchor="middle"
                    fill="#eaf6ff"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {mod.name}
                  </text>
                  
                  {/* Draw loop branches */}
                  {mod.loops.map((loop, lIdx) => {
                    const loopX = modX + (lIdx === 0 ? -40 : 40);
                    const loopY = modY + 50;

                    // Check if any device in this loop has an alarm
                    const hasAlarm = Object.values(loop.devices).some(d => d.status === "alarm");
                    const color = hasAlarm ? "var(--red)" : "var(--green)";

                    return (
                      <g key={loop.loopNumber} className="loop-branch">
                        <line
                          x1={modX}
                          y1={modY}
                          x2={loopX}
                          y2={loopY}
                          stroke="rgba(103, 224, 255, 0.2)"
                          strokeWidth="1"
                        />
                        <rect
                          x={loopX - 25}
                          y={loopY - 8}
                          width="50"
                          height="16"
                          rx="4"
                          fill="rgba(10, 24, 44, 0.8)"
                          stroke={color}
                          strokeWidth="1"
                        />
                        <text
                          x={loopX}
                          y={loopY + 4}
                          textAnchor="middle"
                          fill="#eaf6ff"
                          fontSize="9"
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

          {/* Node SVG items */}
          {nodes.map((node) => {
            const isSelected = selectedControllerId === node.id;
            const strokeColor = isSelected ? "var(--cyan)" : "rgba(77, 231, 255, 0.4)";
            const fill = isSelected ? "rgba(77, 231, 255, 0.2)" : "rgba(10, 24, 44, 0.85)";

            // Check if controller has any alarm devices
            const ctrlData = controllers.find((c) => c.id === node.id);
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
                {/* Outer halo */}
                {isSelected && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="40"
                    fill="none"
                    stroke="var(--cyan)"
                    strokeWidth="1"
                    strokeDasharray="4,8"
                    className="halo-rotate"
                  />
                )}
                {/* Node circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="28"
                  fill={fill}
                  stroke={hasAlarm ? "var(--red)" : strokeColor}
                  strokeWidth="2"
                  className="node-circle"
                />
                {/* Node icon placeholder */}
                <g transform={`translate(${node.x - 10}, ${node.y - 10})`}>
                  <path
                    d="M3 3h18v18H3z"
                    fill="none"
                    stroke={hasAlarm ? "var(--red)" : "var(--cyan)"}
                    strokeWidth="1.5"
                  />
                  <path
                    d="M9 3v18M15 3v18M3 9h18M3 15h18"
                    stroke="rgba(77, 231, 255, 0.3)"
                    strokeWidth="1"
                  />
                </g>
                <text
                  x={node.x}
                  y={node.y + 44}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="12"
                  fontWeight="bold"
                >
                  {node.name}
                </text>
                <text
                  x={node.x}
                  y={node.y + 58}
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
              <span className="dot online" />
              <span>正常通信节点 (火灾报警显示控制器)</span>
            </li>
            <li>
              <span className="dot alarm" />
              <span>告警触发节点 (控制器辖下设备包含火警)</span>
            </li>
            <li>
              <span className="dot ring" />
              <span>光纤环网双向通信信道 (支持链路冗余)</span>
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
          {/* Base shadow */}
          <ellipse cx="22" cy="24" rx="18" ry="15" fill="rgba(0,0,0,0.4)" filter="blur(2px)" />
          {/* Outer ring */}
          <circle cx="22" cy="20" r="19" fill="#0c1d33" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
          {/* Outer plate */}
          <circle cx="22" cy="20" r="16" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(103, 224, 255, 0.3)" strokeWidth="0.8" />
          {/* Main 3D Dome */}
          <circle cx="22" cy="20" r="12.5" fill={`url(#${radialId})`} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
          {/* Internal Chamber vents representing fire vents */}
          <path d="M 22 10 L 22 12 M 22 28 L 22 30 M 12 20 L 14 20 M 30 20 L 32 20" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" strokeLinecap="round" />
          {/* Dynamic LED */}
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
          {/* Isometric shadow */}
          <rect x="5" y="7" width="34" height="30" rx="3" fill="rgba(0,0,0,0.4)" filter="blur(1.5px)" />
          {/* 3D bevel bottom */}
          <rect x="5" y="6" width="34" height="29" rx="3" fill="#300303" />
          {/* Main front panel */}
          <rect x="5" y="4" width="34" height="28" rx="3" fill={`url(#${linearId})`} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
          {/* Trigger plate glass area */}
          <rect x="10" y="8" width="24" height="12" rx="1.5" fill="#fcfcfc" stroke="#333" strokeWidth="0.5" />
          {/* Flame Icon or Alert Symbol inside manual pull plate */}
          <path d="M 22 17 C 23.5 17 24 15.5 24 14.5 C 24 13 22.5 11 22 10 C 21.5 11 20 13 20 14.5 C 20 15.5 20.5 17 22 17 Z" fill="#d32f2f" />
          {/* Yellow push cover stripe */}
          <rect x="8" y="22" width="28" height="3" fill="#ffcc00" rx="0.5" />
          {/* Central status LED */}
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
          {/* Box Shadow */}
          <rect x="6" y="8" width="32" height="28" rx="2" fill="rgba(0,0,0,0.5)" filter="blur(1.5px)" />
          {/* 3D side edge */}
          <rect x="6" y="7" width="32" height="27" rx="2" fill="#090f1a" />
          {/* Front Module Panel */}
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
          {/* Gold terminals row at the top */}
          <rect x="9" y="2" width="26" height="3.5" fill="#ffb300" rx="0.5" />
          <line x1="14" y1="2" x2="14" y2="5.5" stroke="#424242" strokeWidth="0.5" />
          <line x1="19" y1="2" x2="19" y2="5.5" stroke="#424242" strokeWidth="0.5" />
          <line x1="24" y1="2" x2="24" y2="5.5" stroke="#424242" strokeWidth="0.5" />
          <line x1="29" y1="2" x2="29" y2="5.5" stroke="#424242" strokeWidth="0.5" />

          {/* Module labels (CT = Control, CR = Monitor) */}
          <text x="22" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff">
            {isCT ? "CT" : "CR"}
          </text>
          
          {/* Tiny Status LED on corner */}
          <circle cx="11" cy="24" r="1.8" fill={ledColor} className={isAlarm ? "led-flash-alarm" : ""} />
        </svg>
      );
    }
  }

  // Render 3D Cabinet SVG representing Parent controller node
  function renderParentCabinetIcon() {
    return (
      <svg className="stereoscopic-svg parent-cabinet-svg" viewBox="0 0 50 50" style={{ width: "48px", height: "48px" }}>
        <defs>
          <linearGradient id="grad-parent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#05e6ff" />
            <stop offset="100%" stopColor="#005b99" />
          </linearGradient>
        </defs>
        <rect x="6" y="4" width="38" height="42" rx="4" fill="#0b1726" stroke="url(#grad-parent)" strokeWidth="2" />
        <path d="M 8 6 L 42 6 L 42 22 L 8 16 Z" fill="rgba(255,255,255,0.06)" />
        <rect x="10" y="9" width="30" height="3" fill="#040910" rx="0.5" />
        <rect x="10" y="16" width="30" height="3" fill="#040910" rx="0.5" />
        <rect x="10" y="23" width="30" height="3" fill="#040910" rx="0.5" />
        <rect x="10" y="30" width="30" height="3" fill="#040910" rx="0.5" />
        <circle cx="13" cy="10.5" r="1.2" fill="#00e5ff" className="led-flash-alarm" />
        <circle cx="18" cy="10.5" r="1.2" fill="#00ff66" />
        <circle cx="13" cy="17.5" r="1.2" fill="#00e5ff" />
        <circle cx="18" cy="17.5" r="1.2" fill="#ffcc00" />
        <circle cx="13" cy="24.5" r="1.2" fill="#ff3b30" className="led-flash-alarm" />
        <circle cx="25" cy="38" r="4.5" fill="none" stroke="var(--cyan)" strokeWidth="1" className="cpu-glow" />
        <circle cx="25" cy="38" r="2" fill="var(--cyan)" />
      </svg>
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
          <div className="network-tab-view">
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
                    <span>控制器节点属性</span>
                  </div>
                  <table className="info-table">
                    <tbody>
                      <tr>
                        <td>节点名称:</td>
                        <td>{currentController.name}</td>
                      </tr>
                      <tr>
                        <td>通信地址:</td>
                        <td>{currentController.address} 号控制器</td>
                      </tr>
                      <tr>
                        <td>连接模块数:</td>
                        <td>{currentController.modules.length} 个回路模块</td>
                      </tr>
                      <tr>
                        <td>通讯状态:</td>
                        <td className={currentController.status === "online" ? "text-green" : "text-red"}>
                          {currentController.status === "online" ? "双向环网在线" : "通信离线"}
                        </td>
                      </tr>
                      <tr>
                        <td>协议标准:</td>
                        <td>GB 16806-2006</td>
                      </tr>
                      <tr>
                        <td>拓扑类型:</td>
                        <td>环状工业以太网网络</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="action-hint">
                    <Info size={13} />
                    <span>点击网络图中的控制器节点可展开回路和通信控制模块分支线</span>
                  </div>
                </div>
              )}
            </div>

            <div className="view-canvas">
              <div className="canvas-header">
                <h3>火灾报警显示控制器连接网络图</h3>
                <span className="muted">层级关系: 控制器节点 -- 回路通信控制模块 -- 回路号 -- 回路设备</span>
              </div>
              {renderNetworkSvg()}
            </div>
          </div>
        ) : (
          <div className="physical-tab-view">
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
                    <p>检测到回路感烟/感温探测器触发红色火警！请立即确认并执行预案流程！</p>
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
                  <strong style={{ fontSize: "14px" }}>回路树形分支布线接线连接图 (混合敷设实际安装拓扑)</strong>
                </div>
                <span className="muted">物理布线规则：混连串联线路，信号光点沿电缆路径流动</span>
              </div>
              
              <div className="table-branch-wrapper">
                <table className="branch-topology-table">
                  <thead>
                    <tr>
                      <th className="row-index-header">安装顺序 / 物理位置</th>
                      {branchNames.map((name, idx) => (
                        <th key={idx} className="branch-col-header">
                          <div className="branch-header-content">
                            <span className="branch-code">分支 #{idx + 1}</span>
                            <span className="branch-name">{name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* HUB connection row at the very top (Parent node: 控制器) */}
                    <tr className="hub-row">
                      <td className="row-index-cell hub-label">主控机柜出线</td>
                      
                      {/* Column 0: Root Controller Out station (Simplified with 3D Cabinet Icon) */}
                      <td className="branch-cell-path parent-node-cell">
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

                      {/* Column 1: Branch 2 (splits at Row 1-2, Row 0 is empty) */}
                      <td className="branch-cell-path cell-empty-wire">
                        {/* Empty in Hub row */}
                      </td>

                      {/* Column 2: Branch 3 splits from Parent Node (HUB Row 0) using horizontal curve */}
                      <td className="branch-cell-path hub-branching-cell">
                        <svg className="curved-branch-svg" viewBox="0 0 300 100" style={{ position: "absolute", top: 0, left: "-200%", width: "300%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
                          <path
                            d="M 16.67 50 Q 83.33 50 83.33 100"
                            fill="none"
                            stroke="rgba(77, 231, 255, 0.45)"
                            strokeWidth="2.5"
                            strokeDasharray="4,2"
                          />
                          <circle r="4" fill="var(--cyan)" className="curved-pulse-glow">
                            <animateMotion
                              path="M 16.67 50 Q 83.33 50 83.33 100"
                              dur="2.5s"
                              repeatCount="indefinite"
                              begin="0.2s"
                            />
                          </circle>
                        </svg>
                        <div className="empty-wire-connector">
                          <div className="connector-dot" />
                        </div>
                      </td>

                      {/* Column 3: Branch 4 (splits at Row 2, Row 0 is empty) */}
                      <td className="branch-cell-path cell-empty-wire">
                        {/* Empty in Hub row */}
                      </td>

                      {/* Column 4: Branch 5 splits from Parent Node (HUB Row 0) using horizontal curve */}
                      <td className="branch-cell-path hub-branching-cell">
                        <svg className="curved-branch-svg" viewBox="0 0 500 100" style={{ position: "absolute", top: 0, left: "-400%", width: "500%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
                          <path
                            d="M 10 50 Q 90 50 90 100"
                            fill="none"
                            stroke="rgba(77, 231, 255, 0.45)"
                            strokeWidth="2.5"
                            strokeDasharray="4,2"
                          />
                          <circle r="4" fill="var(--cyan)" className="curved-pulse-glow">
                            <animateMotion
                              path="M 10 50 Q 90 50 90 100"
                              dur="2.8s"
                              repeatCount="indefinite"
                              begin="0.4s"
                            />
                          </circle>
                        </svg>
                        <div className="empty-wire-connector">
                          <div className="connector-dot" />
                        </div>
                      </td>
                    </tr>

                    {/* Positions 1 to 6 on each branch */}
                    {Array(maxRows)
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

                            {/* 5 Columns (Branches) */}
                            {branchNames.map((_, colIdx) => {
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

                              // Branch wire logic rules according to drawing:
                              // - Col 0 (Branch 1): Vertical wire on Row 1 to Row 5.
                              // - Col 1 (Branch 2): Vertical wire on Row 2 to Row 6.
                              // - Col 2 (Branch 3): Vertical wire on Row 1 to Row 6.
                              // - Col 3 (Branch 4): Vertical wire on Row 3 to Row 5.
                              // - Col 4 (Branch 5): Vertical wire on Row 1.
                              const hasVerticalWire = 
                                (colIdx === 0 && rowIdx <= 5) || 
                                (colIdx === 1 && rowIdx >= 2 && rowIdx <= 6) || 
                                (colIdx === 2 && rowIdx <= 6) || 
                                (colIdx === 3 && rowIdx >= 3 && rowIdx <= 5) || 
                                (colIdx === 4 && rowIdx === 1);

                              // Curved split overlays:
                              // - Branch 2 splits at Row 1 of Col 1 (connecting Col 0 Row 1 to Col 1 Row 2)
                              const isBranch2SplitRow = rowIdx === 1 && colIdx === 1;

                              // - Branch 4 splits at Row 2 of Col 3 (connecting Col 2 Row 2 to Col 3 Row 3)
                              const isBranch4SplitRow = rowIdx === 2 && colIdx === 3;

                              // Cascade animation delays for pulsing dot in standard vertical lines
                              let flowDelay = "0s";
                              if (colIdx === 0) {
                                flowDelay = `${rowIdx * 0.45}s`;
                              } else if (colIdx === 1 && rowIdx >= 2) {
                                // Splits after Col 0 Row 1 (0.45s) + curve transit (0.6s) + descends
                                flowDelay = `${1.05 + (rowIdx - 1) * 0.45}s`;
                              } else if (colIdx === 2) {
                                flowDelay = `${0.2 + rowIdx * 0.45}s`;
                              } else if (colIdx === 3 && rowIdx >= 3) {
                                // Splits after Col 2 Row 2 (1.1s) + curve transit (0.6s) + descends
                                flowDelay = `${1.7 + (rowIdx - 2) * 0.45}s`;
                              } else if (colIdx === 4 && rowIdx === 1) {
                                flowDelay = `${0.4 + 0.45}s`;
                              }

                              return (
                                <td key={colIdx} className="branch-cell-path">
                                  {/* Render vertical wires */}
                                  {hasVerticalWire && (
                                    <div className="vertical-wire-route">
                                      <div
                                        className={`vertical-pulse-dot ${dev ? dev.status : "empty"}`}
                                        style={{ animationDelay: flowDelay }}
                                      />
                                    </div>
                                  )}

                                  {/* Render Branch 2 curved split at Row 1 (flows from Col 0 Row 1) */}
                                  {isBranch2SplitRow && (
                                    <svg className="curved-branch-svg" viewBox="0 0 200 100" style={{ position: "absolute", top: 0, left: "-100%", width: "200%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
                                      <path
                                        d="M 25 50 Q 75 50 75 100"
                                        fill="none"
                                        stroke="rgba(77, 231, 255, 0.45)"
                                        strokeWidth="2.5"
                                        strokeDasharray="4,2"
                                      />
                                      <circle r="4" fill="var(--cyan)" className="curved-pulse-glow">
                                        <animateMotion
                                          path="M 25 50 Q 75 50 75 100"
                                          dur="2s"
                                          repeatCount="indefinite"
                                          begin="1.05s"
                                        />
                                      </circle>
                                    </svg>
                                  )}

                                  {/* Render Branch 4 curved split at Row 2 (flows from Col 2 Row 2) */}
                                  {isBranch4SplitRow && (
                                    <svg className="curved-branch-svg" viewBox="0 0 200 100" style={{ position: "absolute", top: 0, left: "-100%", width: "200%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
                                      <path
                                        d="M 25 50 Q 75 50 75 100"
                                        fill="none"
                                        stroke="rgba(77, 231, 255, 0.45)"
                                        strokeWidth="2.5"
                                        strokeDasharray="4,2"
                                      />
                                      <circle r="4" fill="var(--cyan)" className="curved-pulse-glow">
                                        <animateMotion
                                          path="M 25 50 Q 75 50 75 100"
                                          dur="2s"
                                          repeatCount="indefinite"
                                          begin="1.70s"
                                        />
                                      </circle>
                                    </svg>
                                  )}

                                  {dev ? (
                                    <div
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
                                    hasVerticalWire && (
                                      <div className="empty-wire-connector">
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
                        <p className="muted">通过模拟测试按键，可以在该回路节点注入告警或物理断路，验证系统应急响应流：</p>
                        
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
