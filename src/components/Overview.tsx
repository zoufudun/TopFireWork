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

          {/* Realistic multi-layer animated vertical flame SVG */}
          <div className="fire-flame-panel" style={{ width: "280px", height: "160px", right: "16px", bottom: "-20px", overflow: "visible" }}>
            <svg viewBox="0 0 100 140" style={{ width: "100%", height: "100%", overflow: "visible" }}>
              <defs>
                {/* Outer flame — deep red to transparent orange */}
                <linearGradient id="flameOuterGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#8B0000" />
                  <stop offset="25%" stopColor="#cc2200" />
                  <stop offset="55%" stopColor="#ff6600" />
                  <stop offset="85%" stopColor="#ffaa00" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#ffee00" stopOpacity="0" />
                </linearGradient>
                {/* Mid flame — orange */}
                <linearGradient id="flameMainGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#cc3300" />
                  <stop offset="40%" stopColor="#ff6600" />
                  <stop offset="75%" stopColor="#ffcc00" />
                  <stop offset="100%" stopColor="#ffee88" stopOpacity="0" />
                </linearGradient>
                {/* Core — bright yellow-white */}
                <linearGradient id="flameCoreGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#ff9900" />
                  <stop offset="50%" stopColor="#ffee00" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                {/* Inner tip — white hot */}
                <linearGradient id="flameTipGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#ffdd00" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <filter id="flameGlow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Layer 1 — wide outer halo */}
              <path d="M 50 130 C 5 130, -8 80, 30 28 C 34 52, 42 55, 46 28 C 50 8, 54 8, 58 28 C 62 55, 68 52, 72 28 C 105 80, 95 130, 50 130 Z"
                fill="url(#flameOuterGrad)" filter="url(#flameGlow)" className="svg-flame-outer" opacity="0.85" />

              {/* Layer 2 — main flame body */}
              <path d="M 50 130 C 18 130, 10 88, 38 38 C 41 56, 48 58, 50 38 C 52 58, 59 56, 62 38 C 90 88, 82 130, 50 130 Z"
                fill="url(#flameMainGrad)" filter="url(#flameGlow)" className="svg-flame-main" />

              {/* Layer 3 — inner core */}
              <path d="M 50 130 C 30 130, 26 96, 44 60 C 46 72, 50 74, 54 60 C 72 96, 68 130, 50 130 Z"
                fill="url(#flameCoreGrad)" className="svg-flame-core" />

              {/* Layer 4 — bright tip */}
              <path d="M 50 130 C 38 130, 36 108, 46 80 C 48 88, 52 88, 54 80 C 62 108, 60 130, 50 130 Z"
                fill="url(#flameTipGrad)" className="svg-flame-inner" />

              {/* Ember sparks rising */}
              {[0,1,2,3,4,5,6].map(i => (
                <circle key={i} cx={18 + i * 10} cy={115 - i * 6} r={1.2 + (i % 3) * 0.6}
                  fill={i % 2 === 0 ? "#ffee88" : "#ff9900"}
                  style={{ animation: `sparkRise ${0.8 + i * 0.2}s infinite ease-out`, animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </svg>
          </div>


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
