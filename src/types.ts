export type AlarmLevel = 1 | 2 | 3 | 4;

export type AlarmStatus =
  | "new"
  | "acknowledged"
  | "processing"
  | "resolved";

export type DeviceType =
  | "smoke"
  | "temperature"
  | "manual"
  | "sprinkler"
  | "broadcast"
  | "module";

export type DeviceStatus =
  | "online"
  | "warning"
  | "alarm"
  | "offline";

export interface Position {
  x: number;
  y: number;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  floorId: string;
  zoneId: string;
  position: Position;
  status: DeviceStatus;
  value: number;
  unit: string;
  lastSeen: string;
}

export interface AlarmTimelineItem {
  id: string;
  time: string;
  action: string;
  operator: string;
}

export interface Alarm {
  id: string;
  level: AlarmLevel;
  title: string;
  description: string;
  floorId: string;
  zoneId: string;
  deviceId: string;
  source: string;
  status: AlarmStatus;
  createdAt: string;
  updatedAt: string;
  assignee?: string;
  timeline: AlarmTimelineItem[];
}

export interface FloorZone {
  id: string;
  name: string;
  path: string;
}

export interface Floor {
  id: string;
  name: string;
  zones: FloorZone[];
}

export type PageKey =
  | "overview"
  | "alarms"
  | "twin"
  | "devices"
  | "topology";

export interface TelemetryPayload {
  deviceId: string;
  value: number;
  status: DeviceStatus;
  timestamp: string;
}

export interface AlarmCreatedPayload {
  alarm: Alarm;
}

export interface AlarmStatusPayload {
  alarmId: string;
  operator: string;
}

// Fire Loop Topology types
export interface TopologyDevice {
  address: number;      // Loop device address: 1-250
  id: string;           // E.g., CTRL01-MOD1-L1-ADDR005
  name: string;
  type: "smoke" | "temperature" | "manual" | "monitor" | "control";
  status: DeviceStatus;
  value?: number;
  unit?: string;
  lastSeen?: string;
  serialNumber?: string;
  personalityCode?: string;
  location?: string;
}

export interface FireLoop {
  loopNumber: number;   // Loop number, e.g., 1 or 2
  devices: { [address: number]: TopologyDevice };
}

export interface LoopModule {
  id: string;           // E.g., CTRL01-MOD1
  index: number;        // Module index, e.g., 1
  name: string;         // Module name
  status: "online" | "offline";
  loops: FireLoop[];    // Each module has two loops
}

export interface ControllerNode {
  id: string;           // E.g., CTRL01
  address: number;      // Controller address
  name: string;
  status: "online" | "offline";
  modules: LoopModule[];
}