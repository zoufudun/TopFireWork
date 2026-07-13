import {
  CheckCircle2,
  Clock3,
  PlayCircle,
  ShieldAlert,
  Layers,
  Flame,
  AlertTriangle,
  Info,
  Calendar,
  MapPin,
  Cpu,
  Search
} from "lucide-react";
import { useMemo, useState } from "react";
import { eventBus } from "../events/eventBus";
import { useFireStore } from "../store/useFireStore";
import type {
  AlarmLevel,
  AlarmStatus,
  Alarm
} from "../types";

type FilterValue = "all" | AlarmStatus;

const levelLabels: Record<AlarmLevel, string> = {
  1: "一级·严重",
  2: "二级·较重",
  3: "三级·一般",
  4: "四级·提示"
};

const statusLabels: Record<AlarmStatus, string> = {
  new: "待确认",
  acknowledged: "已确认",
  processing: "处置中",
  resolved: "已恢复"
};

const floorNames: Record<string, string> = {
  F3: "3F 办公层",
  F2: "2F 会议层",
  B1: "B1 设备层"
};

const zoneNames: Record<string, string> = {
  "F3-EAST": "东侧办公区",
  "F3-WEST": "西侧办公区",
  "F3-CORRIDOR": "中央走廊",
  "F3-CORE": "设备核心区",
  "F2-HALL": "会议大厅",
  "F2-ROOM": "多功能室",
  "F2-CORRIDOR": "疏散走廊",
  "B1-POWER": "配电间",
  "B1-PUMP": "消防泵房",
  "B1-CORRIDOR": "地下走廊"
};

function getAlarmType(alarm: { title: string; description: string; level: number }): "fire" | "fault" | "status" {
  const t = (alarm.title + " " + alarm.description).toLowerCase();
  if (t.includes("故障") || t.includes("离线") || t.includes("断开") || t.includes("失去通信") || t.includes("异常")) {
    return "fault";
  }
  if (t.includes("烟雾") || t.includes("温度过高") || t.includes("火警") || t.includes("报警") || t.includes("手报") || t.includes("火灾")) {
    return "fire";
  }
  if (alarm.level === 1 || alarm.level === 2) {
    return "fire";
  }
  if (alarm.level === 3) {
    return "fault";
  }
  return "status";
}

function resolveDeviceAddress(deviceId: string): string {
  if (deviceId.includes("-L") && deviceId.includes("-ADDR")) {
    const parts = deviceId.split("-");
    const ctrlNum = parts[0].replace("CTRL", "");
    const modNum = parts[1].replace("MOD", "");
    const loopNum = parts[2].replace("L", "");
    const addrNum = parseInt(parts[3].replace("ADDR", ""), 10);
    return `${ctrlNum}#控制器柜 - ${modNum}#回路卡 - 第${loopNum}回路 - 地址 #${addrNum}`;
  }

  if (deviceId === "SMK-F3-001") {
    return "1#控制器柜 - 1#回路卡 - 第1回路 - 地址 #14";
  }
  if (deviceId === "TMP-F3-002") {
    return "1#控制器柜 - 1#回路卡 - 第1回路 - 地址 #3";
  }
  if (deviceId === "SMK-F3-003") {
    return "1#控制器柜 - 1#回路卡 - 第2回路 - 地址 #92";
  }
  if (deviceId === "MAN-F3-004") {
    return "1#控制器柜 - 2#回路卡 - 第3回路 - 地址 #188";
  }
  if (deviceId === "SPR-F3-005") {
    return "1#控制器柜 - 2#回路卡 - 第3回路 - 地址 #210";
  }
  if (deviceId === "TMP-B1-001") {
    return "1#控制器柜 - 1#回路卡 - 第1回路 - 地址 #28";
  }
  if (deviceId === "SMK-B1-002") {
    return "1#控制器柜 - 1#回路卡 - 第2回路 - 地址 #105";
  }
  if (deviceId === "BRD-F2-001") {
    return "1#控制器柜 - 2#回路卡 - 第3回路 - 地址 #242";
  }

  return `1#控制器柜 - 1#回路卡 - 第1回路 - 地址 #001`;
}

export function AlarmCenter() {
  const {
    alarms,
    selectedAlarmId,
    selectAlarm,
    setSelectedFloor,
    setPage
  } = useFireStore();

  // Unified sleek filters state
  const [filterStatus, setFilterStatus] = useState<FilterValue>("all");
  const [filterType, setFilterType] = useState<"all" | "fire" | "fault" | "status">("all");

  // Advanced history queries states
  const [queryController, setQueryController] = useState("all"); // "all" | "1"
  const [queryLocation, setQueryLocation] = useState("all");     // "all" | "F3" | "F2" | "B1"
  const [queryTimePeriod, setQueryTimePeriod] = useState("all"); // "all" | "24h" | "3d" | "7d" | "custom"
  const [customStartTime, setCustomStartTime] = useState("");
  const [customEndTime, setCustomEndTime] = useState("");
  const [searchQuery, setSearchQuery] = useState("");            // Keyword search

  // Filter alarms based on ALL query dimensions
  const filteredAlarms = useMemo(() => {
    return alarms.filter((alarm) => {
      // 1. Status Filter
      if (filterStatus !== "all" && alarm.status !== filterStatus) {
        return false;
      }
      // 2. Type Filter (Icon tabs)
      const type = getAlarmType(alarm);
      if (filterType !== "all" && type !== filterType) {
        return false;
      }
      // 3. Controller filter (Advanced query)
      if (queryController !== "all") {
        const address = resolveDeviceAddress(alarm.deviceId);
        if (!address.includes(`${queryController}#控制器柜`)) {
          return false;
        }
      }
      // 4. Spatial location filter (Advanced query)
      if (queryLocation !== "all" && alarm.floorId !== queryLocation) {
        return false;
      }
      // 5. Time period filter (Advanced query)
      if (queryTimePeriod !== "all") {
        const alarmTime = new Date(alarm.createdAt).getTime();
        const now = Date.now();
        if (queryTimePeriod === "24h" && alarmTime < now - 24 * 60 * 60 * 1000) {
          return false;
        }
        if (queryTimePeriod === "3d" && alarmTime < now - 3 * 24 * 60 * 60 * 1000) {
          return false;
        }
        if (queryTimePeriod === "7d" && alarmTime < now - 7 * 24 * 60 * 60 * 1000) {
          return false;
        }
        if (queryTimePeriod === "custom") {
          if (customStartTime && alarmTime < new Date(customStartTime).getTime()) {
            return false;
          }
          if (customEndTime) {
            // Include the whole end day
            const endLimit = new Date(customEndTime).getTime() + 24 * 60 * 60 * 1000 - 1;
            if (alarmTime > endLimit) {
              return false;
            }
          }
        }
      }
      // 6. Free text query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const address = resolveDeviceAddress(alarm.deviceId).toLowerCase();
        const matches =
          alarm.title.toLowerCase().includes(query) ||
          alarm.description.toLowerCase().includes(query) ||
          alarm.deviceId.toLowerCase().includes(query) ||
          address.includes(query) ||
          (floorNames[alarm.floorId] || "").toLowerCase().includes(query) ||
          (zoneNames[alarm.zoneId] || "").toLowerCase().includes(query);
        if (!matches) return false;
      }
      return true;
    });
  }, [alarms, filterStatus, filterType, queryController, queryLocation, queryTimePeriod, customStartTime, customEndTime, searchQuery]);

  // Sort: Fire Alarms ALWAYS first, then by date descending
  const sortedAlarms = useMemo(() => {
    const list = [...filteredAlarms];
    list.sort((a, b) => {
      const typeA = getAlarmType(a);
      const typeB = getAlarmType(b);

      if (typeA === "fire" && typeB !== "fire") return -1;
      if (typeA !== "fire" && typeB === "fire") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [filteredAlarms]);

  const stats = useMemo(() => {
    let total = alarms.length;
    let fire = 0;
    let fault = 0;
    let statusVal = 0;
    alarms.forEach((a) => {
      const type = getAlarmType(a);
      if (type === "fire") fire++;
      else if (type === "fault") fault++;
      else if (type === "status") statusVal++;
    });
    return { total, fire, fault, status: statusVal };
  }, [alarms]);

  const selectedAlarm = alarms.find(
    (alarm) => alarm.id === selectedAlarmId
  );

  function emitAction(
    type:
      | "alarm:acknowledge"
      | "alarm:process"
      | "alarm:resolve"
  ) {
    if (!selectedAlarm) return;

    eventBus.emit(type, {
      alarmId: selectedAlarm.id,
      operator: "演示值班员"
    });
  }

  function locateAlarm() {
    if (!selectedAlarm) return;
    setSelectedFloor(selectedAlarm.floorId);
    setPage("twin");
  }

  function resetAllFilters() {
    setFilterStatus("all");
    setFilterType("all");
    setQueryController("all");
    setQueryLocation("all");
    setQueryTimePeriod("all");
    setCustomStartTime("");
    setCustomEndTime("");
    setSearchQuery("");
  }

  return (
    <section className="alarm-workbench">
      <article className="panel alarm-queue" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* Title Heading */}
        <div className="panel-heading" style={{ padding: "16px 20px 8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="eyebrow">ALARM WORKBENCH</span>
            <h2>告警控制台</h2>
          </div>
        </div>

        {/* Classification Counter Cards */}
        <div className="alarm-stats-grid">
          <button
            className={`alarm-stat-card total ${filterType === "all" ? "active" : ""}`}
            onClick={() => setFilterType("all")}
          >
            <div className="stat-icon-wrapper">
              <Layers size={16} />
            </div>
            <div className="stat-info">
              <span className="stat-label">总数记录</span>
              <strong className="stat-val">{stats.total}</strong>
            </div>
            <span className="stat-status-dot total" />
          </button>

          <button
            className={`alarm-stat-card fire ${filterType === "fire" ? "active" : ""}`}
            onClick={() => setFilterType(filterType === "fire" ? "all" : "fire")}
          >
            <div className="stat-icon-wrapper">
              <Flame size={16} />
            </div>
            <div className="stat-info">
              <span className="stat-label">火警数量</span>
              <strong className="stat-val">{stats.fire}</strong>
            </div>
            <span className="stat-status-dot fire" style={{ animation: stats.fire > 0 ? "blinkActive 0.6s infinite alternate" : "none" }} />
          </button>

          <button
            className={`alarm-stat-card fault ${filterType === "fault" ? "active" : ""}`}
            onClick={() => setFilterType(filterType === "fault" ? "all" : "fault")}
          >
            <div className="stat-icon-wrapper">
              <AlertTriangle size={16} />
            </div>
            <div className="stat-info">
              <span className="stat-label">故障数量</span>
              <strong className="stat-val">{stats.fault}</strong>
            </div>
            <span className="stat-status-dot fault" />
          </button>

          <button
            className={`alarm-stat-card status ${filterType === "status" ? "active" : ""}`}
            onClick={() => setFilterType(filterType === "status" ? "all" : "status")}
          >
            <div className="stat-icon-wrapper">
              <Info size={16} />
            </div>
            <div className="stat-info">
              <span className="stat-label">状态数量</span>
              <strong className="stat-val">{stats.status}</strong>
            </div>
            <span className="stat-status-dot status" />
          </button>
        </div>

        {/* 1. Integrated Search & Advanced Queries Grid */}
        <div className="history-query-form" style={{ padding: "14px 20px 8px 20px", background: "rgba(0, 0, 0, 0.12)", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginBottom: "10px" }}>
            {/* Controller filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                <Cpu size={12} className="text-cyan" /> 控制器筛选
              </label>
              <select
                value={queryController}
                onChange={(e) => setQueryController(e.target.value)}
                style={{
                  background: "rgba(10, 24, 44, 0.9)",
                  border: "1px solid var(--line)",
                  borderRadius: "6px",
                  color: "#fff",
                  padding: "6px 10px",
                  fontSize: "12px",
                  cursor: "pointer"
                }}
              >
                <option value="all">全部控制器</option>
                <option value="1">1# 控制器柜</option>
                <option value="2">2# 控制器柜</option>
                <option value="3">3# 控制器柜</option>
              </select>
            </div>

            {/* Spatial Location Filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                <MapPin size={12} className="text-cyan" /> 空间位置
              </label>
              <select
                value={queryLocation}
                onChange={(e) => setQueryLocation(e.target.value)}
                style={{
                  background: "rgba(10, 24, 44, 0.9)",
                  border: "1px solid var(--line)",
                  borderRadius: "6px",
                  color: "#fff",
                  padding: "6px 10px",
                  fontSize: "12px",
                  cursor: "pointer"
                }}
              >
                <option value="all">全部位置</option>
                <option value="F3">3F 办公层</option>
                <option value="F2">2F 会议层</option>
                <option value="B1">B1 设备层</option>
              </select>
            </div>

            {/* Time period filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                <Calendar size={12} className="text-cyan" /> 查询时间段
              </label>
              <select
                value={queryTimePeriod}
                onChange={(e) => setQueryTimePeriod(e.target.value)}
                style={{
                  background: "rgba(10, 24, 44, 0.9)",
                  border: "1px solid var(--line)",
                  borderRadius: "6px",
                  color: "#fff",
                  padding: "6px 10px",
                  fontSize: "12px",
                  cursor: "pointer"
                }}
              >
                <option value="all">全部历史时间</option>
                <option value="24h">最近 24 小时</option>
                <option value="3d">最近 3 天</option>
                <option value="7d">最近 7 天</option>
                <option value="custom">自定义时间段</option>
              </select>
            </div>

            {/* Keyword History Search */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                <Search size={12} className="text-cyan" /> 关键字查询
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="查询设备名 / ID / 地址..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: "rgba(10, 24, 44, 0.9)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    color: "#fff",
                    padding: "6px 26px 6px 10px",
                    fontSize: "12px",
                    width: "100%",
                    boxSizing: "border-box"
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "6px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "0",
                      color: "var(--muted)",
                      fontSize: "10px",
                      cursor: "pointer"
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Conditional Custom Date/Time Range picker */}
          {queryTimePeriod === "custom" && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px",
              background: "rgba(10, 24, 44, 0.6)",
              border: "1px solid rgba(77, 231, 255, 0.12)",
              borderRadius: "8px",
              marginBottom: "10px",
              animation: "fadeIn 0.25s ease-out"
            }}>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>起止时间:</span>
              <input
                type="date"
                value={customStartTime}
                onChange={(e) => setCustomStartTime(e.target.value)}
                style={{
                  background: "rgba(10, 24, 44, 0.9)",
                  border: "1px solid var(--line)",
                  borderRadius: "5px",
                  color: "#fff",
                  fontSize: "11px",
                  padding: "3px 6px",
                  cursor: "pointer"
                }}
              />
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>至</span>
              <input
                type="date"
                value={customEndTime}
                onChange={(e) => setCustomEndTime(e.target.value)}
                style={{
                  background: "rgba(10, 24, 44, 0.9)",
                  border: "1px solid var(--line)",
                  borderRadius: "5px",
                  color: "#fff",
                  fontSize: "11px",
                  padding: "3px 6px",
                  cursor: "pointer"
                }}
              />
              {(customStartTime || customEndTime) && (
                <button
                  onClick={() => { setCustomStartTime(""); setCustomEndTime(""); }}
                  style={{
                    background: "rgba(255, 77, 94, 0.15)",
                    border: "1px solid rgba(255, 77, 94, 0.3)",
                    color: "#ff4d5e",
                    borderRadius: "4px",
                    fontSize: "10px",
                    padding: "2px 6px",
                    cursor: "pointer",
                    marginLeft: "auto"
                  }}
                >
                  清空日期
                </button>
              )}
            </div>
          )}

          {/* Reset Filters Quick Button if any active filter */}
          {(queryController !== "all" || queryLocation !== "all" || queryTimePeriod !== "all" || searchQuery) && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
              <button
                onClick={resetAllFilters}
                style={{
                  background: "rgba(77, 231, 255, 0.08)",
                  border: "1px dashed rgba(77, 231, 255, 0.3)",
                  borderRadius: "6px",
                  color: "var(--cyan)",
                  fontSize: "10.5px",
                  padding: "3px 10px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                重置历史筛选条件
              </button>
            </div>
          )}
        </div>

        {/* 2. Optimized Sleek Types & Status Capsule Filter Bar */}
        <div className="filter-tabs-capsule-bar" style={{
          padding: "10px 20px",
          background: "rgba(0, 0, 0, 0.22)",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          {/* Left Side: Type Filter (Pure icons structure with labels) */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)", marginRight: "4px" }}>信息类别:</span>
            <div style={{
              display: "flex",
              background: "rgba(10, 24, 44, 0.75)",
              border: "1px solid var(--line)",
              borderRadius: "20px",
              padding: "2px",
              gap: "2px"
            }}>
              {(
                [
                  ["all", <Layers size={14} />, "全部", "#fff"],
                  ["fire", <Flame size={14} />, "火警", "#ff4d5e"],
                  ["fault", <AlertTriangle size={14} />, "故障", "#ffba52"],
                  ["status", <Info size={14} />, "状态", "#4de7ff"]
                ] as const
              ).map(([value, icon, tooltip, color]) => {
                const isActive = filterType === value;
                return (
                  <button
                    key={value}
                    onClick={() => setFilterType(value)}
                    title={tooltip}
                    style={{
                      background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                      border: "0",
                      borderRadius: "16px",
                      color: isActive ? color : "var(--muted)",
                      padding: "4px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      boxShadow: isActive ? `0 0 6px ${color}22` : "none"
                    }}
                  >
                    {icon}
                    <span style={{ fontSize: "10px" }}>{tooltip}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Side: Status Filter Segment Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)", marginRight: "4px" }}>处置状态:</span>
            <div style={{
              display: "flex",
              background: "rgba(10, 24, 44, 0.75)",
              border: "1px solid var(--line)",
              borderRadius: "20px",
              padding: "2px",
              gap: "2px"
            }}>
              {(
                [
                  ["all", "全部"],
                  ["new", "待确认"],
                  ["acknowledged", "已确认"],
                  ["processing", "处置中"],
                  ["resolved", "已恢复"]
                ] as const
              ).map(([value, label]) => {
                const isActive = filterStatus === value;
                return (
                  <button
                    key={value}
                    onClick={() => setFilterStatus(value)}
                    style={{
                      background: isActive ? "var(--cyan)" : "transparent",
                      border: "0",
                      borderRadius: "16px",
                      color: isActive ? "#000" : "var(--muted)",
                      padding: "4px 12px",
                      fontSize: "11px",
                      fontWeight: isActive ? "bold" : "normal",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Alarm List View */}
        <div className="alarm-table" style={{ flexGrow: 1, overflowY: "auto" }}>
          {sortedAlarms.length > 0 ? (
            sortedAlarms.map((alarm) => {
              const type = getAlarmType(alarm);
              return (
                <button
                  key={alarm.id}
                  className={`alarm-row level-${alarm.level} ${alarm.id === selectedAlarmId ? "selected" : ""
                    }`}
                  onClick={() => selectAlarm(alarm.id)}
                  style={{
                    borderLeft: type === "fire" ? "4px solid #ff4d5e" : type === "fault" ? "4px solid #ffba52" : "4px solid #4de7ff",
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.02)",
                    position: "relative",
                    overflow: "hidden"
                  }}
                >
                  {type === "fire" && (
                    <div className="spark-container" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden", pointerEvents: "none" }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className="spark-particle"
                          style={{
                            position: "absolute",
                            bottom: "-4px",
                            left: `${15 + i * 18}%`,
                            width: `${2 + (i % 2)}px`,
                            height: `${2 + (i % 2)}px`,
                            backgroundColor: i % 2 === 0 ? "#ff7675" : "#ffbe76",
                            borderRadius: "50%",
                            boxShadow: "0 0 4px rgba(255, 118, 117, 0.9), 0 0 8px rgba(255, 77, 94, 0.7)",
                            animation: `sparkRise ${1.2 + (i % 3) * 0.3}s infinite ease-out`,
                            animationDelay: `${i * 0.15}s`,
                            // @ts-ignore
                            "--drift": `${(i % 2 === 0 ? -12 : 12) + (i % 3) * 4}px`
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <span className="level-badge" style={{
                    background: type === "fire" ? "rgba(255, 77, 94, 0.2)" : type === "fault" ? "rgba(255, 186, 82, 0.2)" : "rgba(77, 231, 255, 0.2)",
                    color: type === "fire" ? "#ff4d5e" : type === "fault" ? "#ffba52" : "#4de7ff",
                    fontSize: "10px",
                    fontWeight: "bold",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    minWidth: "60px",
                    textAlign: "center"
                  }}>
                    {`L${alarm.level} · ${type === "fire" ? "火警" : type === "fault" ? "故障" : "提示"}`}
                  </span>

                  <span className="alarm-main" style={{ flexGrow: 1, paddingLeft: "12px", textAlign: "left" }}>
                    <strong className={type === "fire" ? "fire-flame-text" : undefined} style={{ fontSize: "13.5px", display: "inline-block" }}>
                      {type === "fire" ? `🔥 ${alarm.title}` : alarm.title}
                    </strong>
                    <small style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "var(--muted)" }}>
                      {floorNames[alarm.floorId] || alarm.floorId} · {zoneNames[alarm.zoneId] || alarm.zoneId} | {resolveDeviceAddress(alarm.deviceId)}
                    </small>
                  </span>

                  <span className="alarm-time" style={{ fontSize: "11px", color: "var(--muted)", flexShrink: 0, padding: "0 10px" }}>
                    {new Date(alarm.createdAt).toLocaleTimeString()}
                  </span>

                  <span className={`status-tag ${alarm.status}`} style={{ flexShrink: 0 }}>
                    {statusLabels[alarm.status]}
                  </span>
                </button>
              );
            })
          ) : (
            <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--muted)" }}>
              🔍 未找到匹配历史或当前过滤条件的告警信息记录。
            </div>
          )}
        </div>
      </article>

      <aside className="panel alarm-detail">
        {selectedAlarm ? (
          <>
            <div className="alarm-detail-head">
              <span className={`large-level level-${selectedAlarm.level}`}>
                {levelLabels[selectedAlarm.level]}
              </span>
              <span className={`status-tag ${selectedAlarm.status}`}>
                {statusLabels[selectedAlarm.status]}
              </span>
            </div>

            <h2 className={getAlarmType(selectedAlarm) === "fire" ? "fire-flame-text" : undefined}>
              {getAlarmType(selectedAlarm) === "fire" ? `🔥 ${selectedAlarm.title}` : selectedAlarm.title}
            </h2>
            <p>{selectedAlarm.description}</p>

            <dl className="detail-list compact">
              <div>
                <dt>信息类型</dt>
                <dd>
                  {getAlarmType(selectedAlarm) === "fire" ? (
                    <span style={{ color: "#ff4d5e", fontWeight: "bold" }}>🔥 红色特级火警</span>
                  ) : getAlarmType(selectedAlarm) === "fault" ? (
                    <span style={{ color: "#ffba52", fontWeight: "bold" }}>⚠️ 橙色设备故障</span>
                  ) : (
                    <span style={{ color: "#4de7ff" }}>ℹ️ 蓝色状态提示</span>
                  )}
                </dd>
              </div>
              {getAlarmType(selectedAlarm) === "fire" && (
                <div>
                  <dt>防消灭火模式</dt>
                  <dd>
                    {selectedAlarm.linkageType === "mist" || (!selectedAlarm.linkageType && selectedAlarm.floorId !== "B1") ? (
                      <span style={{ color: "var(--cyan)", fontWeight: "bold" }}>💧 联锁高压细水雾灭火</span>
                    ) : (
                      <span style={{ color: "var(--red)", fontWeight: "bold" }}>🔥 联锁 1301 气体灭火</span>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt>事件地址</dt>
                <dd style={{ color: "#4de7ff", fontFamily: "monospace", fontSize: "12px", fontWeight: "bold", wordBreak: "break-all" }}>
                  {resolveDeviceAddress(selectedAlarm.deviceId)}
                </dd>
              </div>
              <div>
                <dt>空间位置</dt>
                <dd>
                  {floorNames[selectedAlarm.floorId] || selectedAlarm.floorId} / {zoneNames[selectedAlarm.zoneId] || selectedAlarm.zoneId}
                </dd>
              </div>
              <div>
                <dt>发生时间</dt>
                <dd style={{ color: "#fff" }}>
                  {new Date(selectedAlarm.createdAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt>事件来源</dt>
                <dd>{selectedAlarm.source}</dd>
              </div>
              <div>
                <dt>事件编号</dt>
                <dd style={{ fontFamily: "monospace", fontSize: "11px" }}>{selectedAlarm.id}</dd>
              </div>
              <div>
                <dt>责任人员</dt>
                <dd>{selectedAlarm.assignee ?? "尚未分派"}</dd>
              </div>
            </dl>

            <div className="workflow-actions">
              {selectedAlarm.status === "new" && (
                <button
                  className="action-primary"
                  onClick={() =>
                    emitAction("alarm:acknowledge")
                  }
                >
                  <ShieldAlert size={17} />
                  确认告警
                </button>
              )}

              {selectedAlarm.status === "acknowledged" && (
                <button
                  className="action-primary"
                  onClick={() => emitAction("alarm:process")}
                >
                  <PlayCircle size={17} />
                  开始处置
                </button>
              )}

              {selectedAlarm.status === "processing" && (
                <button
                  className="action-primary"
                  onClick={() => emitAction("alarm:resolve")}
                >
                  <CheckCircle2 size={17} />
                  完成处置
                </button>
              )}

              <button
                className="action-secondary"
                onClick={locateAlarm}
              >
                定位楼层图
              </button>
            </div>

            <div className="timeline">
              <h3>处置时间线</h3>

              {[...selectedAlarm.timeline]
                .reverse()
                .map((item) => (
                  <div className="timeline-item" key={item.id}>
                    <Clock3 size={15} />
                    <div>
                      <strong>{item.action}</strong>
                      <span>
                        {item.operator} ·{" "}
                        {new Date(item.time).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <ShieldAlert size={42} />
            <strong>暂无选中告警</strong>
          </div>
        )}
      </aside>
    </section>
  );
}
