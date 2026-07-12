import { eventBus } from "../events/eventBus";
import { useFireStore } from "../store/useFireStore";
import type { Alarm, Device, DeviceStatus } from "../types";

let timer: number | undefined;
let tickCount = 0;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nextValue(device: Device): number {
  const noise = (Math.random() - 0.5) * 4;

  if (device.type === "smoke") {
    return Number(clamp(device.value + noise, 0, 90).toFixed(1));
  }

  if (device.type === "temperature") {
    return Number(clamp(device.value + noise * 0.35, 18, 65).toFixed(1));
  }

  return device.value;
}

function calculateStatus(
  device: Device,
  value: number
): DeviceStatus {
  if (Math.random() < 0.006) return "offline";

  if (device.type === "smoke") {
    if (value >= 55) return "alarm";
    if (value >= 28) return "warning";
  }

  if (device.type === "temperature") {
    if (value >= 52) return "alarm";
    if (value >= 38) return "warning";
  }

  return "online";
}

function createAlarm(device: Device): Alarm {
  const time = new Date().toISOString();
  const isCritical = device.status === "alarm";

  return {
    id: `ALM-${Date.now()}-${device.id}`,
    level: isCritical ? 1 : 2,
    title:
      device.type === "smoke"
        ? "模拟烟雾指标异常"
        : "模拟温度指标异常",
    description: `${device.name} 的模拟遥测数据已达到告警阈值。`,
    floorId: device.floorId,
    zoneId: device.zoneId,
    deviceId: device.id,
    source: device.name,
    status: "new",
    createdAt: time,
    updatedAt: time,
    timeline: [
      {
        id: crypto.randomUUID(),
        time,
        action: "模拟事件引擎创建告警",
        operator: "Simulator"
      }
    ]
  };
}

function tick(): void {
  const state = useFireStore.getState();
  if (!state.simulationRunning) return;

  tickCount += 1;

  state.devices.forEach((device) => {
    const value = nextValue(device);
    const status = calculateStatus(device, value);

    eventBus.emit("telemetry:updated", {
      deviceId: device.id,
      value,
      status,
      timestamp: new Date().toISOString()
    });
  });

  // Simulate topology devices
  state.controllers.forEach((ctrl) => {
    if (ctrl.status === "offline") return;
    ctrl.modules.forEach((mod) => {
      if (mod.status === "offline") return;
      mod.loops.forEach((loop) => {
        Object.keys(loop.devices).forEach((addrKey) => {
          const addr = Number(addrKey);
          const dev = loop.devices[addr];
          if (!dev || dev.status === "offline") return;

          if (dev.type === "smoke" || dev.type === "temperature") {
            const noise = (Math.random() - 0.5) * 2;
            let val = dev.value || 0;
            let status = dev.status;

            if (dev.type === "smoke") {
              val = Number(Math.min(90, Math.max(0, val + noise)).toFixed(1));
              status = val >= 55 ? "alarm" : val >= 28 ? "warning" : "online";
            } else {
              val = Number(Math.min(65, Math.max(18, val + noise * 0.3)).toFixed(1));
              status = val >= 52 ? "alarm" : val >= 38 ? "warning" : "online";
            }

            // 0.05% chance to randomly fire a warning/alarm event
            if (Math.random() < 0.0005) {
              status = "alarm";
              val = dev.type === "smoke" ? 62.1 : 54.3;
            }

            state.updateTopologyDeviceStatus(ctrl.id, mod.id, loop.loopNumber, addr, status, val);
          } else {
            // Other modules can occasionally change status for demo
            if (Math.random() < 0.0002) {
              const nextStatus = Math.random() < 0.1 ? "alarm" : "online";
              state.updateTopologyDeviceStatus(ctrl.id, mod.id, loop.loopNumber, addr, nextStatus);
            }
          }
        });
      });
    });
  });

  // 每隔若干周期随机产生一条演示告警，避免告警列表过快膨胀。
  if (tickCount % 8 === 0) {
    const candidates = useFireStore
      .getState()
      .devices.filter(
        (device) =>
          device.type === "smoke" ||
          device.type === "temperature"
      );

    const device =
      candidates[Math.floor(Math.random() * candidates.length)];

    if (device) {
      eventBus.emit("alarm:created", {
        alarm: createAlarm(device)
      });
    }
  }
}

export function startSimulator(): void {
  if (timer !== undefined) return;
  timer = window.setInterval(tick, 1800);
}

export function stopSimulator(): void {
  if (timer !== undefined) {
    window.clearInterval(timer);
    timer = undefined;
  }
}