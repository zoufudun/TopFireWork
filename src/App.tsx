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
  { id: "topology", label: "回路拓扑", icon: Network }
];

export default function App() {
  const {
    page,
    setPage,
    alarms,
    simulationRunning,
    setSimulationRunning
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
    </div>
  );
}
