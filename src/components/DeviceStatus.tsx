import {
  CircleDot,
  RadioTower,
  Search
} from "lucide-react";
import { useMemo, useState } from "react";
import { useFireStore } from "../store/useFireStore";
import type { DeviceStatus as DeviceState } from "../types";

const statusText: Record<DeviceState, string> = {
  online: "在线",
  warning: "预警",
  alarm: "告警",
  offline: "离线"
};

export function DeviceStatus() {
  const { devices, selectDevice, setSelectedFloor, setPage } =
    useFireStore();

  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<"all" | DeviceState>("all");

  const result = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();

    return devices.filter((device) => {
      const matchesKeyword =
        !normalized ||
        device.name.toLowerCase().includes(normalized) ||
        device.id.toLowerCase().includes(normalized);

      const matchesStatus =
        status === "all" || device.status === status;

      return matchesKeyword && matchesStatus;
    });
  }, [devices, keyword, status]);

  function locate(deviceId: string, floorId: string) {
    selectDevice(deviceId);
    setSelectedFloor(floorId);
    setPage("twin");
  }

  return (
    <section className="panel device-page">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">DEVICE HEALTH</span>
          <h2>设备状态中心</h2>
        </div>

        <div className="device-summary">
          <RadioTower size={18} />
          在线{" "}
          {devices.filter((item) => item.status !== "offline").length}
          /{devices.length}
        </div>
      </div>

      <div className="device-toolbar">
        <label className="search-box">
          <Search size={17} />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索设备名称或编号"
          />
        </label>

        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as "all" | DeviceState)
          }
        >
          <option value="all">全部状态</option>
          <option value="online">在线</option>
          <option value="warning">预警</option>
          <option value="alarm">告警</option>
          <option value="offline">离线</option>
        </select>
      </div>

      <div className="device-grid">
        {result.map((device) => (
          <button
            className={`device-card ${device.status}`}
            key={device.id}
            onClick={() => locate(device.id, device.floorId)}
          >
            <CircleDot size={25} />

            <div>
              <strong>{device.name}</strong>
              <small>{device.id}</small>
            </div>

            <span className={`status-tag ${device.status}`}>
              {statusText[device.status]}
            </span>

            <div className="device-reading">
              {device.value}
              <small>{device.unit}</small>
            </div>

            <footer>
              <span>{device.floorId}</span>
              <span>{device.zoneId}</span>
            </footer>
          </button>
        ))}
      </div>
    </section>
  );
}
