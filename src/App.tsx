import {
  BellRing,
  Boxes,
  Gauge,
  Network,
  Pause,
  Play,
  RadioTower,
  RotateCcw,
  ServerCog,
  ShieldAlert
} from "lucide-react";
import { useEffect, useState } from "react";
import { AlarmCenter } from "./components/AlarmCenter";
import { DeviceStatus } from "./components/DeviceStatus";
import { DigitalTwin } from "./components/DigitalTwin";
import { LoopTopology } from "./components/LoopTopology";
import { Overview } from "./components/Overview";
import { FireLinkage } from "./components/FireLinkage";
import { eventBus } from "./events/eventBus";
import {
  startSimulator,
  stopSimulator
} from "./simulator/simulator";
import { useFireStore } from "./store/useFireStore";
import type { PageKey } from "./types";

const navItems: Array<{
  id: PageKey;
  label: string;
  icon: typeof Gauge;
}> = [
  { id: "overview", label: "态势总览", icon: Gauge },
  { id: "alarms", label: "告警中心", icon: BellRing },
  { id: "twin", label: "数字孪生", icon: Boxes },
  { id: "devices", label: "设备状态", icon: ServerCog },
  { id: "topology", label: "回路拓扑", icon: Network },
  { id: "linkage", label: "灭火联动", icon: RadioTower }
];

export default function App() {
  const {
    page,
    setPage,
    alarms,
    simulationRunning,
    setSimulationRunning,
    showGlobalInterlockPrompt,
    globalInterlockSource,
    globalInterlockMethod,
    setShowGlobalInterlockPrompt,
    setPendingLinkageAutoStart
  } = useFireStore();

  const [time, setTime] = useState(new Date());

  const activeAlarmCount = alarms.filter(
    (alarm) => alarm.status !== "resolved"
  ).length;

  useEffect(() => {
    startSimulator();

    const clock = window.setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      stopSimulator();
      window.clearInterval(clock);
    };
  }, []);

  function toggleSimulation() {
    const next = !simulationRunning;
    setSimulationRunning(next);

    if (next) startSimulator();
  }

  function renderPage() {
    switch (page) {
      case "alarms":
        return <AlarmCenter />;
      case "twin":
        return <DigitalTwin />;
      case "devices":
        return <DeviceStatus />;
      case "topology":
        return <LoopTopology />;
      case "linkage":
        return <FireLinkage />;
      default:
        return <Overview />;
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <ShieldAlert size={26} />
          </div>

          <div>
            <strong>FIRETWIN</strong>
            <span>智能消防数字孪生</span>
          </div>
        </div>

        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={page === item.id ? "active" : undefined}
                onClick={() => setPage(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>

                {item.id === "alarms" && activeAlarmCount > 0 && (
                  <b>{activeAlarmCount}</b>
                )}
              </button>
            );
          })}
        </nav>

        <div className="simulation-card">
          <div>
            <RadioTower size={18} />
            <strong>模拟数据流</strong>
          </div>

          <span className={simulationRunning ? "running" : ""}>
            {simulationRunning ? "RUNNING" : "PAUSED"}
          </span>

          <button onClick={toggleSimulation}>
            {simulationRunning ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
            {simulationRunning ? "暂停模拟" : "继续模拟"}
          </button>

          <button
            className="ghost"
            onClick={() =>
              eventBus.emit("simulation:reset", undefined)
            }
          >
            <RotateCcw size={16} />
            重置数据
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="demo-badge">
              DEMO / 原型演示
            </span>
            <h1>
              {navItems.find((item) => item.id === page)?.label}
            </h1>
          </div>

          <div className="system-status">
            <span>
              <i />
              事件总线正常
            </span>
            <span>
              <i />
              孪生引擎在线
            </span>
            <time>
              {time.toLocaleDateString()}{" "}
              {time.toLocaleTimeString()}
            </time>
          </div>
        </header>

        <div className="safety-notice">
          <ShieldAlert size={18} />
          <strong>演示模式：</strong>
          当前数据与操作均为模拟，不连接、不控制真实消防设施。
        </div>

        <div className="page-content">{renderPage()}</div>
      </main>

      {/* 炫酷的“火警联锁驱动中”全局提示层 (模拟培训与联锁控制) */}
      {showGlobalInterlockPrompt && page !== "linkage" && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(3, 8, 16, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999999
        }}>
          <div style={{
            width: "420px",
            background: "linear-gradient(135deg, rgba(88, 10, 20, 0.98) 0%, rgba(16, 5, 8, 0.99) 100%)",
            border: "2.5px solid #ff4d5e",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 20px 50px rgba(255, 77, 94, 0.4), 0 0 30px rgba(255, 77, 94, 0.2)",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            textAlign: "center"
          }}>
            {/* Shield Alert blinking */}
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(255, 77, 94, 0.15)",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <ShieldAlert size={30} color="#ff4d5e" style={{ animation: "flash 0.6s infinite alternate" }} />
            </div>

            <div>
              <h2 style={{ margin: "0 0 6px 0", fontSize: "17.5px", color: "#fff", fontWeight: "900", letterSpacing: "0.08em" }}>
                🚨 现场模拟火警联锁驱动中
              </h2>
              <span style={{ fontSize: "10px", color: "var(--cyan)", fontWeight: "bold", letterSpacing: "0.15em" }}>
                TRAINING INTERLOCK SYSTEM DRIVING
              </span>
            </div>

            <div style={{
              fontSize: "12px",
              color: "#ffd5d9",
              lineHeight: "1.6",
              background: "rgba(0, 0, 0, 0.35)",
              padding: "12px 14px",
              borderRadius: "10px",
              textAlign: "left",
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}>
              控制总线已联动触发，请操作人员前往灭火联动控制中心，确认真实性并执行自动/手动灭火流程：
              <div style={{ margin: "8px 0 2px 0", fontSize: "10.5px", color: "rgba(255, 255, 255, 0.6)" }}>
                警告触发源设备：
              </div>
              <strong style={{ color: "#fff", fontSize: "12.5px", display: "block", wordBreak: "break-all" }}>
                {globalInterlockSource || "未知回路探测器"}
              </strong>
              <div style={{ margin: "6px 0 2px 0", fontSize: "10.5px", color: "rgba(255, 255, 255, 0.6)" }}>
                联动防消灭火介质：
              </div>
              <strong style={{ color: "var(--cyan)", fontSize: "12.5px", display: "block" }}>
                {globalInterlockMethod === "1301" ? "🔥 1301 气体自动喷洒保护区" : "💧 高压细水雾自动灭火保护区"}
              </strong>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setShowGlobalInterlockPrompt(false);
                  setPendingLinkageAutoStart(true);
                  setPage("linkage");
                }}
                style={{
                  flex: 1.3,
                  background: "linear-gradient(135deg, var(--red), #e74c3c)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(255, 77, 94, 0.4)",
                  transition: "all 0.2s"
                }}
              >
                立即进入联动控制中心执行
              </button>
              <button
                onClick={() => setShowGlobalInterlockPrompt(false)}
                style={{
                  flex: 0.7,
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "var(--muted)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                忽略提示
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
