import {
  CheckCircle2,
  Clock3,
  PlayCircle,
  ShieldAlert
} from "lucide-react";
import { useMemo, useState } from "react";
import { eventBus } from "../events/eventBus";
import { useFireStore } from "../store/useFireStore";
import type {
  AlarmLevel,
  AlarmStatus
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

export function AlarmCenter() {
  const {
    alarms,
    selectedAlarmId,
    selectAlarm,
    setSelectedFloor,
    setPage
  } = useFireStore();

  const [filter, setFilter] = useState<FilterValue>("all");

  const filteredAlarms = useMemo(
    () =>
      filter === "all"
        ? alarms
        : alarms.filter((alarm) => alarm.status === filter),
    [alarms, filter]
  );

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

  return (
    <section className="alarm-workbench">
      <article className="panel alarm-queue">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ALARM WORKBENCH</span>
            <h2>分级告警队列</h2>
          </div>

          <strong className="queue-total">
            {filteredAlarms.length}
          </strong>
        </div>

        <div className="filter-tabs">
          {(
            [
              ["all", "全部"],
              ["new", "待确认"],
              ["acknowledged", "已确认"],
              ["processing", "处置中"],
              ["resolved", "已恢复"]
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "active" : undefined}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="alarm-table">
          {filteredAlarms.map((alarm) => (
            <button
              key={alarm.id}
              className={`alarm-row level-${alarm.level} ${
                alarm.id === selectedAlarmId ? "selected" : ""
              }`}
              onClick={() => selectAlarm(alarm.id)}
            >
              <span className="level-badge">
                L{alarm.level}
              </span>

              <span className="alarm-main">
                <strong>{alarm.title}</strong>
                <small>
                  {alarm.floorId} · {alarm.zoneId} ·{" "}
                  {alarm.deviceId}
                </small>
              </span>

              <span className="alarm-time">
                {new Date(alarm.createdAt).toLocaleTimeString()}
              </span>

              <span className={`status-tag ${alarm.status}`}>
                {statusLabels[alarm.status]}
              </span>
            </button>
          ))}
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

            <h2>{selectedAlarm.title}</h2>
            <p>{selectedAlarm.description}</p>

            <dl className="detail-list compact">
              <div>
                <dt>事件编号</dt>
                <dd>{selectedAlarm.id}</dd>
              </div>
              <div>
                <dt>事件来源</dt>
                <dd>{selectedAlarm.source}</dd>
              </div>
              <div>
                <dt>空间位置</dt>
                <dd>
                  {selectedAlarm.floorId} / {selectedAlarm.zoneId}
                </dd>
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
