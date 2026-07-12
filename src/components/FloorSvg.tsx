import type { Device, Floor } from "../types";

interface FloorSvgProps {
  floor: Floor;
  devices: Device[];
  selectedDeviceId?: string;
  onSelectDevice: (deviceId: string) => void;
}

function statusColor(status: Device["status"]): string {
  const colors: Record<Device["status"], string> = {
    online: "#37f2c1",
    warning: "#ffba52",
    alarm: "#ff4d5e",
    offline: "#66758e"
  };

  return colors[status];
}

function deviceLabel(device: Device): string {
  const labels: Record<Device["type"], string> = {
    smoke: "烟",
    temperature: "温",
    manual: "手",
    sprinkler: "喷",
    broadcast: "播",
    module: "模"
  };

  return labels[device.type];
}

export function FloorSvg({
  floor,
  devices,
  selectedDeviceId,
  onSelectDevice
}: FloorSvgProps) {
  const alarmZoneIds = new Set(
    devices
      .filter((device) => device.status === "alarm")
      .map((device) => device.zoneId)
  );

  return (
    <svg
      className="floor-svg"
      viewBox="0 0 600 480"
      role="img"
      aria-label={`${floor.name}数字孪生平面图`}
    >
      <defs>
        <pattern
          id="smallGrid"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="rgba(77,221,255,.08)"
            strokeWidth="1"
          />
        </pattern>

        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect
        width="600"
        height="480"
        rx="22"
        fill="url(#smallGrid)"
      />

      {floor.zones.map((zone) => {
        const alarm = alarmZoneIds.has(zone.id);

        return (
          <g key={zone.id}>
            <path
              className={`floor-zone ${alarm ? "zone-alarm" : ""}`}
              d={zone.path}
            />

            <text
              className="zone-label"
              x={zone.id.includes("WEST") ? 420 : 85}
              y={zone.id.includes("CORRIDOR") ? 280 : 78}
            >
              {zone.name}
            </text>
          </g>
        );
      })}

      {devices.map((device) => {
        const selected = selectedDeviceId === device.id;
        const color = statusColor(device.status);

        return (
          <g
            key={device.id}
            className="device-node"
            transform={`translate(${device.position.x} ${device.position.y})`}
            onClick={() => onSelectDevice(device.id)}
            role="button"
            tabIndex={0}
          >
            {device.status === "alarm" && (
              <circle
                className="alarm-wave"
                r="27"
                fill="none"
                stroke={color}
              />
            )}

            <circle
              r={selected ? 18 : 15}
              fill="rgba(4,13,28,.95)"
              stroke={color}
              strokeWidth={selected ? 4 : 2}
              filter="url(#glow)"
            />

            <text
              x="0"
              y="5"
              textAnchor="middle"
              fill={color}
              fontSize="12"
              fontWeight="900"
            >
              {deviceLabel(device)}
            </text>
          </g>
        );
      })}

      <path
        className="escape-route"
        d="M60 270 H280 V390 H520"
      />

      <text
        x="440"
        y="420"
        fill="#62eaff"
        fontSize="12"
      >
        模拟疏散方向 →
      </text>
    </svg>
  );
}