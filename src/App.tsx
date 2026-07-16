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
  ShieldAlert,
  Lock,
  LogOut,
  User
} from "lucide-react";
import { useEffect, useState } from "react";
import { AlarmCenter } from "./components/AlarmCenter";
import { DeviceStatus } from "./components/DeviceStatus";
import { DigitalTwin } from "./components/DigitalTwin";
import { LoopTopology } from "./components/LoopTopology";
import { Overview } from "./components/Overview";
import { FireLinkage } from "./components/FireLinkage";
import { Login } from "./components/Login";
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
  { id: "linkage", label: "模拟训练中心", icon: RadioTower }
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
    setPendingLinkageAutoStart,
    loginMode,
    operatorName,
    logout
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
    if (loginMode === "real" && page === "linkage") {
      return <Overview />;
    }
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

  if (loginMode === null) {
    return <Login />;
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
          {navItems
            .filter((item) => !(loginMode === "real" && item.id === "linkage"))
            .map((item) => {
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

        {loginMode !== "real" && (
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
        )}

        {/* 操作员电子授权签名与退出系统看板 */}
        <div className="operator-profile-badge">
          <div className={`operator-profile-info ${loginMode}`}>
            <div className="operator-avatar">
              <User size={15} />
            </div>
            <div className="operator-meta">
              <strong>{operatorName}</strong>
              <span>{loginMode === "real" ? "真实现实 (安全只读)" : "模拟训练模式 (仿真)"}</span>
            </div>
          </div>
          <button className="logout-action-btn" onClick={() => logout()}>
            <LogOut size={13} />
            <span>退出终端登出</span>
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="demo-badge">
              {loginMode === "real" ? "REAL / 真实现实" : "SIM / 模拟训练"}
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

        <div className="safety-notice" style={{
          background: loginMode === "real" ? "rgba(255, 77, 94, 0.1)" : undefined,
          border: loginMode === "real" ? "1px solid rgba(255, 77, 94, 0.2)" : undefined,
          color: loginMode === "real" ? "#ff8894" : undefined
        }}>
          {loginMode === "real" ? <Lock size={18} /> : <ShieldAlert size={18} />}
          {loginMode === "real" ? (
            <strong>🔒 安全只读已激活：浏览器、服务与消息通道均已物理闭锁。严禁向下写入消音、复位及联动触发指令。</strong>
          ) : (
            <strong>🟢 模拟训练模式：当前处于仿真教学演练状态，控制操作仅在虚拟网关与仿真引擎内执行。</strong>
          )}
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
          background: "rgba(3, 8, 16, 0.75)",
          backdropFilter: "blur(5px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999999
        }}>
          {loginMode === "real" ? (
            /* 真实现实只读提示框 */
            <div style={{
              width: "440px",
              background: "linear-gradient(135deg, rgba(88, 10, 20, 0.98) 0%, rgba(16, 5, 8, 0.99) 100%)",
              border: "2.5px solid #ff4d5e",
              borderRadius: "16px",
              padding: "26px",
              boxShadow: "0 20px 50px rgba(255, 77, 94, 0.35)",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              textAlign: "center"
            }}>
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
                <Lock size={30} color="#ff4d5e" style={{ animation: "flash 0.6s infinite alternate" }} />
              </div>

              <div>
                <h2 style={{ margin: "0 0 6px 0", fontSize: "17.5px", color: "#fff", fontWeight: "900", letterSpacing: "0.08em" }}>
                  🚨 物理火警联锁报警触发
                </h2>
                <span style={{ fontSize: "10px", color: "var(--red)", fontWeight: "bold", letterSpacing: "0.15em" }}>
                  PHYSICAL FIRE ALARM BLOCKED INTERLOCK
                </span>
              </div>

              <div style={{
                fontSize: "12px",
                color: "#ffd5d9",
                lineHeight: "1.6",
                background: "rgba(0, 0, 0, 0.4)",
                padding: "12px 14px",
                borderRadius: "10px",
                textAlign: "left",
                border: "1px solid rgba(255, 255, 255, 0.05)"
              }}>
                监测到实际消防设备发生火警触发联锁！出于物理隔离和只读边界限制，此终端<strong>无权且已物理闭锁</strong>下发自动/手动联动控制指令。
                <div style={{ margin: "8px 0 2px 0", fontSize: "10.5px", color: "rgba(255, 255, 255, 0.6)" }}>
                  报警源点位：
                </div>
                <strong style={{ color: "#fff", fontSize: "12.5px", display: "block", wordBreak: "break-all" }}>
                  {globalInterlockSource || "未知回路探测器"}
                </strong>
                <div style={{ margin: "6px 0 2px 0", fontSize: "10.5px", color: "rgba(255, 255, 255, 0.6)" }}>
                  应联动防消介质 (只读状态)：
                </div>
                <strong style={{ color: "var(--cyan)", fontSize: "12.5px", display: "block" }}>
                  {globalInterlockMethod === "1301" ? "🔥 1301 气体自动喷洒保护区" : "💧 高压细水雾自动灭火保护区"}
                </strong>
                <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--amber)", fontWeight: "bold" }}>
                  ⚠️ 提示：请相关操作员前往现场或直接通过物理消防主控制柜进行应急消音、复位及联动确认！
                </div>
              </div>

              <button
                onClick={() => setShowGlobalInterlockPrompt(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "#fff",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                确认并关闭警告提示
              </button>
            </div>
          ) : (
            /* 模拟训练下的提示框，可以进入联动控制中心执行 */
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
          )}
        </div>
      )}
    </div>
  );
}
