import { create } from "zustand";
import { initialAlarms, initialDevices, initialControllers } from "../data/mock";
import { eventBus } from "../events/eventBus";
import type {
  Alarm,
  AlarmStatus,
  Device,
  PageKey,
  TelemetryPayload,
  ControllerNode,
  TopologyDevice,
  DeviceStatus
} from "../types";

interface FireState {
  page: PageKey;
  selectedFloorId: string;
  selectedDeviceId?: string;
  selectedAlarmId?: string;
  devices: Device[];
  alarms: Alarm[];
  simulationRunning: boolean;

  // Topology State
  controllers: ControllerNode[];
  selectedControllerId?: string;
  selectedModuleId?: string;
  selectedLoopNumber?: number;
  selectedTopologyAddr?: number;

  setPage: (page: PageKey) => void;
  setSelectedFloor: (floorId: string) => void;
  selectDevice: (deviceId?: string) => void;
  selectAlarm: (alarmId?: string) => void;
  setSimulationRunning: (running: boolean) => void;

  // Topology Selectors
  selectController: (id?: string) => void;
  selectModule: (id?: string) => void;
  selectLoop: (loopNumber?: number) => void;
  selectTopologyAddr: (addr?: number) => void;

  updateTelemetry: (payload: TelemetryPayload) => void;
  addAlarm: (alarm: Alarm) => void;
  changeAlarmStatus: (
    alarmId: string,
    status: AlarmStatus,
    operator: string
  ) => void;

  // Topology actions
  updateTopologyDeviceStatus: (
    ctrlId: string,
    modId: string,
    loopNum: number,
    addr: number,
    status: DeviceStatus,
    value?: number
  ) => void;
  triggerTopologyAlarm: (ctrlId: string, modId: string, loopNum: number, addr: number) => void;
  triggerTopologyFault: (ctrlId: string, modId: string, loopNum: number, addr: number) => void;
  resetTopologyDevice: (ctrlId: string, modId: string, loopNum: number, addr: number) => void;

  reset: () => void;
}

export const useFireStore = create<FireState>((set) => ({
  page: "overview",
  selectedFloorId: "F3",
  selectedDeviceId: undefined,
  selectedAlarmId: initialAlarms[0]?.id,
  devices: initialDevices,
  alarms: initialAlarms,
  simulationRunning: true,

  // Topology state init
  controllers: initialControllers,
  selectedControllerId: "CTRL01",
  selectedModuleId: "CTRL01-MOD1",
  selectedLoopNumber: 1,
  selectedTopologyAddr: undefined,

  setPage: (page) => set({ page }),

  setSelectedFloor: (selectedFloorId) =>
    set({ selectedFloorId, selectedDeviceId: undefined }),

  selectDevice: (selectedDeviceId) => set({ selectedDeviceId }),

  selectAlarm: (selectedAlarmId) => set({ selectedAlarmId }),

  setSimulationRunning: (simulationRunning) =>
    set({ simulationRunning }),

  selectController: (selectedControllerId) => {
    set((state) => {
      const ctrl = state.controllers.find((c) => c.id === selectedControllerId);
      const firstMod = ctrl?.modules[0];
      const firstLoop = firstMod?.loops[0];
      return {
        selectedControllerId,
        selectedModuleId: firstMod?.id,
        selectedLoopNumber: firstLoop?.loopNumber,
        selectedTopologyAddr: undefined
      };
    });
  },

  selectModule: (selectedModuleId) => {
    set((state) => {
      const ctrl = state.controllers.find((c) => c.id === state.selectedControllerId);
      const mod = ctrl?.modules.find((m) => m.id === selectedModuleId);
      const firstLoop = mod?.loops[0];
      return {
        selectedModuleId,
        selectedLoopNumber: firstLoop?.loopNumber,
        selectedTopologyAddr: undefined
      };
    });
  },

  selectLoop: (selectedLoopNumber) =>
    set({ selectedLoopNumber, selectedTopologyAddr: undefined }),

  selectTopologyAddr: (selectedTopologyAddr) =>
    set({ selectedTopologyAddr }),

  updateTelemetry: (payload) =>
    set((state) => ({
      devices: state.devices.map((device) =>
        device.id === payload.deviceId
          ? {
              ...device,
              value: payload.value,
              status: payload.status,
              lastSeen: payload.timestamp
            }
          : device
      )
    })),

  addAlarm: (alarm) =>
    set((state) => {
      if (state.alarms.some((item) => item.id === alarm.id)) {
        return state;
      }

      return {
        alarms: [alarm, ...state.alarms],
        selectedAlarmId: alarm.id
      };
    }),

  changeAlarmStatus: (alarmId, status, operator) =>
    set((state) => ({
      alarms: state.alarms.map((alarm) =>
        alarm.id === alarmId
          ? {
              ...alarm,
              status,
              assignee: operator,
              updatedAt: new Date().toISOString(),
              timeline: [
                ...alarm.timeline,
                {
                  id: crypto.randomUUID(),
                  time: new Date().toISOString(),
                  action: statusText(status),
                  operator
                }
              ]
            }
          : alarm
      )
    })),

  updateTopologyDeviceStatus: (ctrlId, modId, loopNum, addr, status, value) => {
    set((state) => ({
      controllers: state.controllers.map((ctrl) => {
        if (ctrl.id !== ctrlId) return ctrl;
        return {
          ...ctrl,
          modules: ctrl.modules.map((mod) => {
            if (mod.id !== modId) return mod;
            return {
              ...mod,
              loops: mod.loops.map((loop) => {
                if (loop.loopNumber !== loopNum) return loop;
                const dev = loop.devices[addr];
                if (!dev) return loop;
                return {
                  ...loop,
                  devices: {
                    ...loop.devices,
                    [addr]: {
                      ...dev,
                      status,
                      value: value !== undefined ? value : dev.value,
                      lastSeen: new Date().toISOString()
                    }
                  }
                };
              })
            };
          })
        };
      })
    }));
  },

  triggerTopologyAlarm: (ctrlId, modId, loopNum, addr) => {
    set((state) => {
      const ctrl = state.controllers.find((c) => c.id === ctrlId);
      const mod = ctrl?.modules.find((m) => m.id === modId);
      const loop = mod?.loops.find((l) => l.loopNumber === loopNum);
      const dev = loop?.devices[addr];
      if (!dev) return state;

      const time = new Date().toISOString();
      const alarmId = `ALM-${Date.now()}-${dev.id}`;
      
      const newAlarm: Alarm = {
        id: alarmId,
        level: 1,
        title: dev.type === "smoke" ? "手动测试: 烟雾浓度严重超标"
             : dev.type === "temperature" ? "手动测试: 温度过高警报"
             : dev.type === "manual" ? "手动测试: 手动报警按钮按下"
             : dev.type === "monitor" ? "手动测试: 监视模块状态异常"
             : "手动测试: 控制模块反馈异常",
        description: `网络与回路拓扑模拟警报: 控制器 ${ctrl?.name}, 模块 ${mod?.name}, 回路 ${loopNum}, 地址 ${addr} (${dev.name}) 触发报警。`,
        floorId: "F3",
        zoneId: "F3-EAST",
        deviceId: dev.id,
        source: dev.name,
        status: "new",
        createdAt: time,
        updatedAt: time,
        timeline: [
          {
            id: crypto.randomUUID(),
            time,
            action: "回路拓扑手动测试触发",
            operator: "系统管理员"
          }
        ]
      };

      const updatedControllers = state.controllers.map((c) => {
        if (c.id !== ctrlId) return c;
        return {
          ...c,
          modules: c.modules.map((m) => {
            if (m.id !== modId) return m;
            return {
              ...m,
              loops: m.loops.map((l) => {
                if (l.loopNumber !== loopNum) return l;
                return {
                  ...l,
                  devices: {
                    ...l.devices,
                    [addr]: {
                      ...dev,
                      status: "alarm",
                      value: dev.type === "smoke" ? 72.5 : dev.type === "temperature" ? 58.6 : undefined,
                      lastSeen: time
                    }
                  }
                };
              })
            };
          })
        };
      });

      return {
        controllers: updatedControllers,
        alarms: [newAlarm, ...state.alarms],
        selectedAlarmId: alarmId
      };
    });
  },

  triggerTopologyFault: (ctrlId, modId, loopNum, addr) => {
    set((state) => {
      const ctrl = state.controllers.find((c) => c.id === ctrlId);
      const mod = ctrl?.modules.find((m) => m.id === modId);
      const loop = mod?.loops.find((l) => l.loopNumber === loopNum);
      const dev = loop?.devices[addr];
      if (!dev) return state;

      const time = new Date().toISOString();
      const updatedControllers = state.controllers.map((c) => {
        if (c.id !== ctrlId) return c;
        return {
          ...c,
          modules: c.modules.map((m) => {
            if (m.id !== modId) return m;
            return {
              ...m,
              loops: m.loops.map((l) => {
                if (l.loopNumber !== loopNum) return l;
                return {
                  ...l,
                  devices: {
                    ...l.devices,
                    [addr]: {
                      ...dev,
                      status: "offline",
                      lastSeen: time
                    }
                  }
                };
              })
            };
          })
        };
      });

      const alarmId = `ALM-${Date.now()}-${dev.id}`;
      const newAlarm: Alarm = {
        id: alarmId,
        level: 3,
        title: "拓扑设备离线故障",
        description: `网络与回路拓扑故障报警: 控制器 ${ctrl?.name}, 模块 ${mod?.name}, 回路 ${loopNum}, 地址 ${addr} (${dev.name}) 失去通信反馈。`,
        floorId: "F3",
        zoneId: "F3-EAST",
        deviceId: dev.id,
        source: dev.name,
        status: "new",
        createdAt: time,
        updatedAt: time,
        timeline: [
          {
            id: crypto.randomUUID(),
            time,
            action: "通信断开警报触发",
            operator: "系统监视器"
          }
        ]
      };

      return {
        controllers: updatedControllers,
        alarms: [newAlarm, ...state.alarms],
        selectedAlarmId: alarmId
      };
    });
  },

  resetTopologyDevice: (ctrlId, modId, loopNum, addr) => {
    set((state) => {
      const ctrl = state.controllers.find((c) => c.id === ctrlId);
      const mod = ctrl?.modules.find((m) => m.id === modId);
      const loop = mod?.loops.find((l) => l.loopNumber === loopNum);
      const dev = loop?.devices[addr];
      if (!dev) return state;

      const time = new Date().toISOString();
      const updatedControllers = state.controllers.map((c) => {
        if (c.id !== ctrlId) return c;
        return {
          ...c,
          modules: c.modules.map((m) => {
            if (m.id !== modId) return m;
            return {
              ...m,
              loops: m.loops.map((l) => {
                if (l.loopNumber !== loopNum) return l;
                return {
                  ...l,
                  devices: {
                    ...l.devices,
                    [addr]: {
                      ...dev,
                      status: "online",
                      value: dev.type === "smoke" ? 9.5 : dev.type === "temperature" ? 21.3 : undefined,
                      lastSeen: time
                    }
                  }
                };
              })
            };
          })
        };
      });

      const updatedAlarms = state.alarms.map((alarm) => {
        if (alarm.deviceId === dev.id && alarm.status !== "resolved") {
          return {
            ...alarm,
            status: "resolved" as const,
            updatedAt: time,
            timeline: [
              ...alarm.timeline,
              {
                id: crypto.randomUUID(),
                time,
                action: "用户在回路拓扑中手动复位设备，告警恢复正常",
                operator: "系统管理员"
              }
            ]
          };
        }
        return alarm;
      });

      return {
        controllers: updatedControllers,
        alarms: updatedAlarms
      };
    });
  },

  reset: () =>
    set({
      devices: initialDevices,
      alarms: initialAlarms,
      selectedAlarmId: initialAlarms[0]?.id,
      selectedDeviceId: undefined,
      selectedFloorId: "F3",
      controllers: initialControllers,
      selectedControllerId: "CTRL01",
      selectedModuleId: "CTRL01-MOD1",
      selectedLoopNumber: 1,
      selectedTopologyAddr: undefined
    })
}));

function statusText(status: AlarmStatus): string {
  const labels: Record<AlarmStatus, string> = {
    new: "告警进入待确认队列",
    acknowledged: "已确认告警",
    processing: "开始处置",
    resolved: "处置完成并归档"
  };

  return labels[status];
}

/**
 * 事件订阅集中在状态边界，UI 不直接处理基础设施事件。
 * 后续可将 mitt 替换为 WebSocket、MQTT 网关或 SSE 适配器。
 */
eventBus.on("telemetry:updated", (payload) => {
  useFireStore.getState().updateTelemetry(payload);
});

eventBus.on("alarm:created", ({ alarm }) => {
  useFireStore.getState().addAlarm(alarm);
});

eventBus.on("alarm:acknowledge", ({ alarmId, operator }) => {
  useFireStore
    .getState()
    .changeAlarmStatus(alarmId, "acknowledged", operator);
});

eventBus.on("alarm:process", ({ alarmId, operator }) => {
  useFireStore
    .getState()
    .changeAlarmStatus(alarmId, "processing", operator);
});

eventBus.on("alarm:resolve", ({ alarmId, operator }) => {
  useFireStore
    .getState()
    .changeAlarmStatus(alarmId, "resolved", operator);
});

eventBus.on("simulation:reset", () => {
  useFireStore.getState().reset();
});