import mitt from "mitt";
import type {
  AlarmCreatedPayload,
  AlarmStatusPayload,
  TelemetryPayload
} from "../types";

export type FireEvents = {
  "telemetry:updated": TelemetryPayload;
  "alarm:created": AlarmCreatedPayload;
  "alarm:acknowledge": AlarmStatusPayload;
  "alarm:process": AlarmStatusPayload;
  "alarm:resolve": AlarmStatusPayload;
  "simulation:reset": undefined;
};

export const eventBus = mitt<FireEvents>();