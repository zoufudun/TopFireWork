import {
  Activity,
  BellRing,
  Cpu,
  RadioTower,
  ShieldCheck
} from "lucide-react";
import { useFireStore } from "../store/useFireStore";
import { DigitalTwin } from "./DigitalTwin";
import { MetricCard } from "./MetricCard";

export function Overview() {
  const {
    alarms,
    devices,
    controllers,
    setPage,
    selectAlarm,
    selectController,
    selectModule,
    selectLoop,
    selectTopologyAddr
  } = useFireStore();

  const activeAlarms = alarms.filter(
    (alarm) => alarm.status !== "resolved"
  );

  const criticalCount = activeAlarms.filter(
    (alarm) => alarm.level === 1
  ).length;

  const onlineCount = devices.filter(
    (device) => device.status !== "offline"
  ).length;

  const onlineRate = devices.length
    ? ((onlineCount / devices.length) * 100).toFixed(1)
    : "0";

  function openAlarm(alarmId: string) {
    selectAlarm(alarmId);
    setPage("alarms");
  }

  // Detect loop device fires (smoke or temperature in alarm state)
  const fireDevices: {
    device: any;
    controllerId: string;
    moduleId: string;
    loopNumber: number;
  }[] = [];

  controllers.forEach((c) => {
    c.modules.forEach((m) => {
      m.loops.forEach((l) => {
        Object.values(l.devices).forEach((d) => {
          if (d.status === "alarm" && (d.type === "smoke" || d.type === "temperature")) {
            fireDevices.push({
              device: d,
              controllerId: c.id,
              moduleId: m.id,
              loopNumber: l.loopNumber
            });
          }
        });
      });
    });
  });

  const hasFire = fireDevices.length > 0;

  return (
    <>
      {/* High-visibility Emergency Fire Alarm Panel in Situation Overview */}
      {hasFire && (
        <div className="emergency-fire-banner animate-pulse-glow" style={{ marginTop: 0, marginBottom: "24px" }}>
          <div className="emergency-header">
            <div className="fire-alert-icon">🔥</div>
            <div className="fire-alert-text">
              <h3>安全态势监测总览：系统检测到火灾报警！</h3>
              <p>回路温感/烟感探测器正在触发火警！请值班安全人员立即执行应急疏散和灭火预案！</p>
            </div>
          </div>

          {/* Animated SVG Roaring Flame Graphics */}
          <div className="fire-flame-panel" style={{ width: "240px", height: "130px", right: "20px", bottom: "-30px", overflow: "visible" }}>
            <svg viewBox="0 0 100 120" style={{ width: "100%", height: "100%", overflow: "visible" }}>
              <defs>
                <linearGradient id="flameOuterGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stop-color="#990000" />
                  <stop offset="30%" stop-color="#ff3b30" />
                  <stop offset="70%" stop-color="#ff9500" />
                  <stop offset="100%" stop-color="#ffcc00" stop-opacity="0" />
                </linearGradient>
                <linearGradient id="flameMainGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stop-color="#ff5e00" />
                  <stop offset="75%" stop-color="#ffcc00" />
                  <stop offset="100%" stop-color="#ffcc00" stop-opacity="0" />
                </linearGradient>
                <linearGradient id="flameCoreGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stop-color="#ffe600" />
                  <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Layer 1: Outer Back Flame */}
              <path d="M 50 110 C 20 110, 10 70, 42 20 C 45 40, 55 40, 58 20 C 90 70, 80 110, 50 110 Z" fill="url(#flameOuterGrad)" filter="url(#glow)" className="flame-outer" />
              
              {/* Layer 2: Main Middle Flame */}
              <path d="M 50 110 C 28 110, 20 78, 45 35 C 47 48, 53 48, 55 35 C 80 78, 72 110, 50 110 Z" fill="url(#flameMainGrad)" filter="url(#glow)" className="flame-main" />
              
              {/* Layer 3: Inner Core */}
              <path d="M 50 110 C 35 110, 30 85, 47 50 C 49 60, 51 60, 53 50 C 70 85, 65 110, 50 110 Z" fill="url(#flameCoreGrad)" className="flame-core" />
            </svg>

            {/* Local thick smoke particles inside the panel */}
            <div style={{ position: "absolute", left: "0", right: "0", top: "0", bottom: "0", pointerEvents: "none", overflow: "hidden" }}>
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="smoke-particle" style={{
                  left: `${20 + Math.random() * 60}%`,
                  width: `${30 + Math.random() * 30}px`,
                  height: `${30 + Math.random() * 30}px`,
                  bottom: "-10px",
                  animationDuration: `${3 + Math.random() * 3}s`,
                  animationDelay: `${idx * 0.4}s`,
                  ...({ "--drift": `${Math.random() * 60 - 30}px` } as React.CSSProperties)
                }} />
              ))}
            </div>
          </div>

          {/* Full-screen floating sparks & smoke overlay */}
          {hasFire && (
            <div className="fire-embers-overlay">
              {/* Dense Embers Sparks (75 particles) */}
              {Array.from({ length: 75 }).map((_, i) => {
                const size = Math.random() * 6 + 3; // 3px to 9px
                const left = Math.random() * 100; // 0% to 100%
                const delay = Math.random() * 6; // 0s to 6s
                const duration = Math.random() * 3 + 3; // 3s to 6s
                const sway = (Math.random() * 100 - 50) + "px"; // -50px to 50px
                return (
                  <div
                    key={`ember-${i}`}
                    className="ember-particle"
                    style={{
                      left: `${left}%`,
                      width: `${size}px`,
                      height: `${size}px`,
                      animationDelay: `${delay}s`,
                      animationDuration: `${duration}s`,
                      ...({ "--sway": sway } as React.CSSProperties)
                    }}
                  />
                );
              })}

              {/* Drifting Smoke Particles (25 particles) */}
              {Array.from({ length: 25 }).map((_, i) => {
                const size = Math.random() * 70 + 50; // 50px to 120px
                const left = Math.random() * 100; // 0% to 100%
                const delay = Math.random() * 8; // 0s to 8s
                const duration = Math.random() * 4 + 7; // 7s to 11s
                const drift = (Math.random() * 160 - 80) + "px"; // -80px to 80px
                return (
                  <div
                    key={`smoke-${i}`}
                    className="smoke-particle"
                    style={{
                      left: `${left}%`,
                      width: `${size}px`,
                      height: `${size}px`,
                      animationDelay: `${delay}s`,
                      animationDuration: `${duration}s`,
                      ...({ "--drift": drift } as React.CSSProperties)
                    }}
                  />
                );
              })}
            </div>
          )}

          <div className="alarm-locations-list">
            <strong>火灾报警物理点位列表：</strong>
            {fireDevices.map(({ device, controllerId, moduleId, loopNumber }) => (
              <div key={device.id} className="alarm-location-item">
                <span className="loc-text">
                  [{device.type === "smoke" ? "烟感火警" : "温感火警"}] 地址 #{device.address} - {device.location || "未知空间定位点"}
                </span>
                <button
                  className="quick-locate-btn"
                  onClick={() => {
                    selectController(controllerId);
                    selectModule(moduleId);
                    selectLoop(loopNumber);
                    selectTopologyAddr(device.address);
                    setPage("topology");
                  }}
                >
                  定位回路并进入拓扑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="metrics-grid">
        <MetricCard
          title="综合安全指数"
          value={hasFire ? 62 : (criticalCount ? 76 : 94)}
          suffix="/100"
          icon={<ShieldCheck />}
          hint="基于告警、设备 and 空间态势模拟"
          tone={hasFire ? "red" : (criticalCount ? "amber" : "cyan")}
        />

        <MetricCard
          title="活动告警"
          value={activeAlarms.length + fireDevices.length}
          suffix=" 条"
          icon={<BellRing />}
          hint={`其中火警/一级危急告警 ${fireDevices.length + criticalCount} 条`}
          tone="red"
        />

        <MetricCard
          title="设备在线率"
          value={onlineRate}
          suffix="%"
          icon={<Cpu />}
          hint={`${onlineCount}/${devices.length} 个孪生对象在线`}
        />

        <MetricCard
          title="事件总线"
          value="ACTIVE"
          icon={<RadioTower />}
          hint="遥测与业务事件持续流转"
          tone="violet"
        />
      </section>

      <section className="overview-grid">
        <div className="overview-twin">
          <DigitalTwin />
        </div>

        <aside className="panel recent-alarm-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">EVENT STREAM</span>
              <h2>最新事件</h2>
            </div>
            <Activity size={19} />
          </div>

          <div className="recent-list">
            {alarms.slice(0, 6).map((alarm) => (
              <button
                key={alarm.id}
                onClick={() => openAlarm(alarm.id)}
                className={`recent-item level-${alarm.level}`}
              >
                <span>L{alarm.level}</span>

                <div>
                  <strong>{alarm.title}</strong>
                  <small>
                    {alarm.floorId} ·{" "}
                    {new Date(
                      alarm.createdAt
                    ).toLocaleTimeString()}
                  </small>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </section>
    </>
  );
}
