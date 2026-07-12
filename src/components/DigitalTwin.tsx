import {
  Activity,
  CircleDot,
  MapPinned,
  Radio
} from "lucide-react";
import { floors } from "../data/mock";
import { useFireStore } from "../store/useFireStore";
import { FloorSvg } from "./FloorSvg";

export function DigitalTwin() {
  const {
    devices,
    selectedFloorId,
    selectedDeviceId,
    setSelectedFloor,
    selectDevice
  } = useFireStore();

  const floor =
    floors.find((item) => item.id === selectedFloorId) ??
    floors[0];

  const floorDevices = devices.filter(
    (device) => device.floorId === floor.id
  );

  const selectedDevice = devices.find(
    (device) => device.id === selectedDeviceId
  );

  return (
    <section className="twin-layout">
      <article className="panel floor-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">DIGITAL TWIN</span>
            <h2>SVG 楼层数字孪生</h2>
          </div>

          <div className="floor-switcher">
            {floors.map((item) => (
              <button
                key={item.id}
                className={
                  item.id === floor.id ? "active" : undefined
                }
                onClick={() => setSelectedFloor(item.id)}
              >
                {item.id}
              </button>
            ))}
          </div>
        </div>

        <div className="twin-stage">
          <div className="scan-line" />

          <FloorSvg
            floor={floor}
            devices={floorDevices}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={selectDevice}
          />
        </div>

        <div className="map-legend">
          <span><i className="dot online" />正常</span>
          <span><i className="dot warning" />预警</span>
          <span><i className="dot alarm" />告警</span>
          <span><i className="dot offline" />离线</span>
        </div>
      </article>

      <aside className="panel twin-inspector">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">OBJECT INSPECTOR</span>
            <h2>孪生对象详情</h2>
          </div>
        </div>

        {selectedDevice ? (
          <>
            <div className={`device-hero ${selectedDevice.status}`}>
              <CircleDot size={34} />
              <div>
                <strong>{selectedDevice.name}</strong>
                <span>{selectedDevice.id}</span>
              </div>
            </div>

            <dl className="detail-list">
              <div>
                <dt>实时读数</dt>
                <dd>
                  {selectedDevice.value}
                  {selectedDevice.unit}
                </dd>
              </div>
              <div>
                <dt>运行状态</dt>
                <dd>{selectedDevice.status}</dd>
              </div>
              <div>
                <dt>所在楼层</dt>
                <dd>{selectedDevice.floorId}</dd>
              </div>
              <div>
                <dt>防火分区</dt>
                <dd>{selectedDevice.zoneId}</dd>
              </div>
              <div>
                <dt>最后通信</dt>
                <dd>
                  {new Date(
                    selectedDevice.lastSeen
                  ).toLocaleTimeString()}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <div className="empty-state">
            <MapPinned size={42} />
            <strong>选择孪生对象</strong>
            <p>点击楼层图中的设备节点查看实时状态。</p>
          </div>
        )}

        <div className="inspector-stream">
          <span><Radio size={15} /> TELEMETRY STREAM</span>
          <span><Activity size={15} /> EVENT BUS ACTIVE</span>
        </div>
      </aside>
    </section>
  );
}
