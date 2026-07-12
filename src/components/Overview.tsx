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
  const { alarms, devices, setPage, selectAlarm } = useFireStore();

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

  return (
    <>
      <section className="metrics-grid">
        <MetricCard
          title="综合安全指数"
          value={criticalCount ? 76 : 94}
          suffix="/100"
          icon={<ShieldCheck />}
          hint="基于告警、设备和空间态势模拟"
          tone={criticalCount ? "amber" : "cyan"}
        />

        <MetricCard
          title="活动告警"
          value={activeAlarms.length}
          suffix=" 条"
          icon={<BellRing />}
          hint={`其中一级告警 ${criticalCount} 条`}
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
