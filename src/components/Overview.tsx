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

          {/* Animated CSS Flame Graphics */}
          <div className="fire-flame-panel">
            <div className="flame-particle p1" />
            <div className="flame-particle p2" />
            <div className="flame-particle p3" />
            <div className="flame-particle p4" />
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
