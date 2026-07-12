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

  const [activeTab, setActiveTab] = useState<"network" | "physical">("network");

  // Search & Filter state for physical loop view
  const [searchAddr, setSearchAddr] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const currentController = controllers.find((c) => c.id === selectedControllerId);
  const currentModule = currentController?.modules.find((m) => m.id === selectedModuleId);
  const currentLoop = currentModule?.loops.find((l) => l.loopNumber === selectedLoopNumber);

  // Statistics
  const totalControllers = controllers.length;
  const onlineControllers = controllers.filter((c) => c.status === "online").length;

  let totalModules = 0;
  let totalLoops = 0;
  let totalConfiguredDevices = 0;
  let alarmCount = 0;
  let faultCount = 0;

  controllers.forEach((c) => {
    totalModules += c.modules.length;
    c.modules.forEach((m) => {
      totalLoops += m.loops.length;
      m.loops.forEach((l) => {
        Object.values(l.devices).forEach((d) => {
          totalConfiguredDevices++;
          if (d.status === "alarm") alarmCount++;
          if (d.status === "offline" || d.status === "warning") faultCount++;
        });
      });
    });
  });

  // Find currently selected topology device
  const selectedDevice =
    currentLoop && selectedTopologyAddr !== undefined
      ? currentLoop.devices[selectedTopologyAddr]
      : undefined;

  // Render SVG Network Topology
  function renderNetworkSvg() {
    // 3 Controller nodes configured in a ring/triangle
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
              // Draw modules branching out
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
            symbol = "烟感探测器";
            break;
          case "temperature":
            symbol = "温感探测器";
            break;
          case "manual":
            symbol = "手动报警按钮";
            break;
          case "monitor":
            symbol = "监视模块CT";
            break;
          case "control":
            symbol = "控制模块CR";
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

  return (
    <div className="loop-topology-container">
      <div className="topology-stats-grid">
        <div className="stat-card">
          <div className="stat-icon cyan">
            <Network size={20} />
          </div>
          <div>
            <span>控制器节点</span>
            <strong>{onlineControllers} <small>/ {totalControllers}</small></strong>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <Cpu size={20} />
          </div>
          <div>
            <span>通信控制模块</span>
            <strong>{totalModules} <small>模块</small></strong>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon violet">
            <Activity size={20} />
          </div>
          <div>
            <span>回路通道</span>
            <strong>{totalLoops} <small>个回路</small></strong>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Info size={20} />
          </div>
          <div>
            <span>挂载回路设备</span>
            <strong>{totalConfiguredDevices} <small>个点位</small></strong>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon red">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span>回路火警点</span>
            <strong className={alarmCount > 0 ? "text-alarm" : ""}>{alarmCount}</strong>
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
                    <option value="warning">数值预警</option>
                    <option value="offline">通信故障</option>
                    <option value="empty">空闲未配置</option>
                  </select>
                </div>
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
                            <td>点位类型:</td>
                            <td>
                              {selectedDevice.type === "smoke" && "感烟火灾探测器"}
                              {selectedDevice.type === "temperature" && "感温火灾探测器"}
                              {selectedDevice.type === "manual" && "手动报警按钮"}
                              {selectedDevice.type === "monitor" && "监视控制模块"}
                              {selectedDevice.type === "control" && "输出控制模块"}
                            </td>
                          </tr>
                          {selectedDevice.value !== undefined && (
                            <tr>
                              <td>监测数值:</td>
                              <td className="telemetry-value">
                                <span>{selectedDevice.value}</span>
                                <small>{selectedDevice.unit}</small>
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td>最近监测更新:</td>
                            <td>{selectedDevice.lastSeen ? new Date(selectedDevice.lastSeen).toLocaleTimeString() : "无记录"}</td>
                          </tr>
                          <tr>
                            <td>所属拓扑路径:</td>
                            <td>{currentController?.name} (地址 {currentController?.address}) &gt; {currentModule?.name} &gt; 回路 {selectedLoopNumber}</td>
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
                        : "请在左侧 1 - 250 回路设备物理矩阵中点击任意一个含有“设备标识”的方格，以激活此属性控制台并执行回路调试。"}
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
