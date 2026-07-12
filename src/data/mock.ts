import type { Alarm, Device, Floor, ControllerNode, TopologyDevice } from "../types";

const now = () => new Date().toISOString();

export const floors: Floor[] = [
  {
    id: "F3",
    name: "3F 办公层",
    zones: [
      {
        id: "F3-EAST",
        name: "东侧办公区",
        path: "M40 45 H290 V205 H40 Z"
      },
      {
        id: "F3-WEST",
        name: "西侧办公区",
        path: "M310 45 H560 V205 H310 Z"
      },
      {
        id: "F3-CORRIDOR",
        name: "中央走廊",
        path: "M40 225 H560 V310 H40 Z"
      },
      {
        id: "F3-CORE",
        name: "设备核心区",
        path: "M215 330 H385 V435 H215 Z"
      }
    ]
  },
  {
    id: "F2",
    name: "2F 会议层",
    zones: [
      {
        id: "F2-HALL",
        name: "会议大厅",
        path: "M40 45 H390 V220 H40 Z"
      },
      {
        id: "F2-ROOM",
        name: "多功能室",
        path: "M410 45 H560 V220 H410 Z"
      },
      {
        id: "F2-CORRIDOR",
        name: "疏散走廊",
        path: "M40 240 H560 V320 H40 Z"
      }
    ]
  },
  {
    id: "B1",
    name: "B1 设备层",
    zones: [
      {
        id: "B1-POWER",
        name: "配电间",
        path: "M40 45 H275 V220 H40 Z"
      },
      {
        id: "B1-PUMP",
        name: "消防泵房",
        path: "M295 45 H560 V220 H295 Z"
      },
      {
        id: "B1-CORRIDOR",
        name: "地下走廊",
        path: "M40 240 H560 V340 H40 Z"
      }
    ]
  }
];

export const initialDevices: Device[] = [
  {
    id: "SMK-F3-001",
    name: "东区烟感 01",
    type: "smoke",
    floorId: "F3",
    zoneId: "F3-EAST",
    position: { x: 118, y: 110 },
    status: "alarm",
    value: 68,
    unit: "ppm",
    lastSeen: now()
  },
  {
    id: "TMP-F3-002",
    name: "东区温感 02",
    type: "temperature",
    floorId: "F3",
    zoneId: "F3-EAST",
    position: { x: 226, y: 148 },
    status: "warning",
    value: 43,
    unit: "℃",
    lastSeen: now()
  },
  {
    id: "SMK-F3-003",
    name: "西区烟感 03",
    type: "smoke",
    floorId: "F3",
    zoneId: "F3-WEST",
    position: { x: 430, y: 120 },
    status: "online",
    value: 8,
    unit: "ppm",
    lastSeen: now()
  },
  {
    id: "MAN-F3-004",
    name: "走廊手报 04",
    type: "manual",
    floorId: "F3",
    zoneId: "F3-CORRIDOR",
    position: { x: 165, y: 267 },
    status: "online",
    value: 0,
    unit: "",
    lastSeen: now()
  },
  {
    id: "SPR-F3-005",
    name: "喷淋末端 05",
    type: "sprinkler",
    floorId: "F3",
    zoneId: "F3-CORE",
    position: { x: 300, y: 382 },
    status: "online",
    value: 0.42,
    unit: "MPa",
    lastSeen: now()
  },
  {
    id: "TMP-B1-001",
    name: "配电间温感 01",
    type: "temperature",
    floorId: "B1",
    zoneId: "B1-POWER",
    position: { x: 145, y: 126 },
    status: "warning",
    value: 38,
    unit: "℃",
    lastSeen: now()
  },
  {
    id: "SMK-B1-002",
    name: "泵房烟感 02",
    type: "smoke",
    floorId: "B1",
    zoneId: "B1-PUMP",
    position: { x: 422, y: 130 },
    status: "online",
    value: 7,
    unit: "ppm",
    lastSeen: now()
  },
  {
    id: "BRD-F2-001",
    name: "会议层消防广播",
    type: "broadcast",
    floorId: "F2",
    zoneId: "F2-HALL",
    position: { x: 180, y: 126 },
    status: "online",
    value: 100,
    unit: "%",
    lastSeen: now()
  }
];

export const initialAlarms: Alarm[] = [
  {
    id: "ALM-20250308-001",
    level: 1,
    title: "烟雾浓度超过严重阈值",
    description: "东侧办公区烟感连续三个采样周期超过阈值。",
    floorId: "F3",
    zoneId: "F3-EAST",
    deviceId: "SMK-F3-001",
    source: "烟感探测器",
    status: "new",
    createdAt: now(),
    updatedAt: now(),
    timeline: [
      {
        id: crypto.randomUUID(),
        time: now(),
        action: "系统生成一级告警",
        operator: "事件引擎"
      }
    ]
  },
  {
    id: "ALM-20250308-002",
    level: 2,
    title: "配电间温度持续升高",
    description: "温度变化率异常，建议现场复核。",
    floorId: "B1",
    zoneId: "B1-POWER",
    deviceId: "TMP-B1-001",
    source: "温感探测器",
    status: "acknowledged",
    createdAt: now(),
    updatedAt: now(),
    assignee: "值班员 A",
    timeline: [
      {
        id: crypto.randomUUID(),
        time: now(),
        action: "已确认并等待现场核查",
        operator: "值班员 A"
      }
    ]
  }
];

function generateMockControllers(): ControllerNode[] {
  const controllers: ControllerNode[] = [];
  
  // Controller 1: Address 1, 2 modules
  const c1Modules = [1, 2].map((modIdx) => {
    const loops = [1, 2].map((loopNum) => {
      const devices: { [address: number]: TopologyDevice } = {};
      const actualLoopNum = (modIdx - 1) * 2 + loopNum; // Loops 1, 2, 3, 4
      
      // Populate some detectors (1-125)
      const detectorAddrs = [3, 14, 28, 45, 76, 92, 105, 120];
      detectorAddrs.forEach((addr) => {
        const type = addr % 2 === 0 ? "smoke" : "temperature";
        const val = type === "smoke" ? 10.2 : 22.5;
        devices[addr] = {
          address: addr,
          id: `CTRL01-MOD${modIdx}-L${actualLoopNum}-ADDR${addr.toString().padStart(3, "0")}`,
          name: `${modIdx}#模块 ${actualLoopNum}#回路 ${addr}号${type === "smoke" ? "感烟探测器" : "感温探测器"}`,
          type,
          status: "online",
          value: val,
          unit: type === "smoke" ? "ppm" : "℃",
          lastSeen: now()
        };
      });

      // Populate some modules/buttons (126-250)
      const moduleAddrs = [130, 155, 188, 210, 242];
      moduleAddrs.forEach((addr) => {
        let type: "manual" | "monitor" | "control" = "manual";
        let typeName = "手动报警按钮";
        if (addr % 3 === 0) {
          type = "monitor";
          typeName = "监视模块";
        } else if (addr % 3 === 1) {
          type = "control";
          typeName = "控制模块";
        }
        devices[addr] = {
          address: addr,
          id: `CTRL01-MOD${modIdx}-L${actualLoopNum}-ADDR${addr.toString().padStart(3, "0")}`,
          name: `${modIdx}#模块 ${actualLoopNum}#回路 ${addr}号${typeName}`,
          type,
          status: "online",
          lastSeen: now()
        };
      });

      return {
        loopNumber: actualLoopNum,
        devices
      };
    });

    return {
      id: `CTRL01-MOD${modIdx}`,
      index: modIdx,
      name: `${modIdx}# 回路通信控制模块`,
      status: "online" as const,
      loops
    };
  });

  controllers.push({
    id: "CTRL01",
    address: 1,
    name: "1# 火灾报警显示控制器",
    status: "online",
    modules: c1Modules
  });

  // Controller 2: Address 2, 1 module
  const c2Modules = [1].map((modIdx) => {
    const loops = [1, 2].map((loopNum) => {
      const devices: { [address: number]: TopologyDevice } = {};
      const detectorAddrs = [8, 35, 62, 88, 115];
      detectorAddrs.forEach((addr) => {
        const type = addr % 2 === 0 ? "smoke" : "temperature";
        const val = type === "smoke" ? 12.1 : 24.8;
        devices[addr] = {
          address: addr,
          id: `CTRL02-MOD${modIdx}-L${loopNum}-ADDR${addr.toString().padStart(3, "0")}`,
          name: `${modIdx}#模块 ${loopNum}#回路 ${addr}号${type === "smoke" ? "感烟探测器" : "感温探测器"}`,
          type,
          status: "online",
          value: val,
          unit: type === "smoke" ? "ppm" : "℃",
          lastSeen: now()
        };
      });

      const moduleAddrs = [140, 195, 230];
      moduleAddrs.forEach((addr) => {
        let type: "manual" | "monitor" | "control" = "manual";
        let typeName = "手动报警按钮";
        if (addr % 3 === 0) {
          type = "monitor";
          typeName = "监视模块";
        } else if (addr % 3 === 1) {
          type = "control";
          typeName = "控制模块";
        }
        devices[addr] = {
          address: addr,
          id: `CTRL02-MOD${modIdx}-L${loopNum}-ADDR${addr.toString().padStart(3, "0")}`,
          name: `${modIdx}#模块 ${loopNum}#回路 ${addr}号${typeName}`,
          type,
          status: "online",
          lastSeen: now()
        };
      });

      return {
        loopNumber: loopNum,
        devices
      };
    });

    return {
      id: `CTRL02-MOD${modIdx}`,
      index: modIdx,
      name: `${modIdx}# 回路通信控制模块`,
      status: "online" as const,
      loops
    };
  });

  controllers.push({
    id: "CTRL02",
    address: 2,
    name: "2# 火灾报警显示控制器",
    status: "online",
    modules: c2Modules
  });

  // Controller 3: Address 3, 1 module
  const c3Modules = [1].map((modIdx) => {
    const loops = [1, 2].map((loopNum) => {
      const devices: { [address: number]: TopologyDevice } = {};
      const detectorAddrs = [12, 54, 99];
      detectorAddrs.forEach((addr) => {
        const type = addr % 2 === 0 ? "smoke" : "temperature";
        const val = type === "smoke" ? 9.8 : 20.3;
        devices[addr] = {
          address: addr,
          id: `CTRL03-MOD${modIdx}-L${loopNum}-ADDR${addr.toString().padStart(3, "0")}`,
          name: `${modIdx}#模块 ${loopNum}#回路 ${addr}号${type === "smoke" ? "感烟探测器" : "感温探测器"}`,
          type,
          status: "online",
          value: val,
          unit: type === "smoke" ? "ppm" : "℃",
          lastSeen: now()
        };
      });

      const moduleAddrs = [162, 222];
      moduleAddrs.forEach((addr) => {
        let type: "manual" | "monitor" | "control" = "manual";
        let typeName = "手动报警按钮";
        if (addr % 2 === 0) {
          type = "control";
          typeName = "控制模块";
        }
        devices[addr] = {
          address: addr,
          id: `CTRL03-MOD${modIdx}-L${loopNum}-ADDR${addr.toString().padStart(3, "0")}`,
          name: `${modIdx}#模块 ${loopNum}#回路 ${addr}号${typeName}`,
          type,
          status: "online",
          lastSeen: now()
        };
      });

      return {
        loopNumber: loopNum,
        devices
      };
    });

    return {
      id: `CTRL03-MOD${modIdx}`,
      index: modIdx,
      name: `${modIdx}# 回路通信控制模块`,
      status: "online" as const,
      loops
    };
  });

  controllers.push({
    id: "CTRL03",
    address: 3,
    name: "3# 火灾报警显示控制器",
    status: "online",
    modules: c3Modules
  });

  return controllers;
}

export const initialControllers = generateMockControllers();