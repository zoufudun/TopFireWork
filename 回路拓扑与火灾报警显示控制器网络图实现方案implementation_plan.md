# 回路拓扑与火灾报警显示控制器网络图实现方案

为系统新增“回路拓扑”导航菜单，提供以下功能：
1. **网络拓扑图**：展示火灾报警显示控制器（Controller）网络图，层级结构为 `控制器 (地址) -- 回路通信控制模块 -- 回路号 -- 回路设备`。
2. **回路物理拓扑**：按控制器节点展示回路设备的物理地址拓扑。每个控制器连接多个回路控制模块，每个模块支持2个回路，每个回路最多250个设备（1-125为烟温探测器，126-250为手报、监视/控制模块）。

---

## 拟引入的新数据模型与状态

### 1. 领域模型扩展 (`src/types.ts`)
- 新增 `topology` 页面类型到 `PageKey`。
- 定义 `TopologyDevice` 结构，表示回路中的挂载设备。
- 定义 `LoopModule` 和 `ControllerNode` 结构。

```typescript
export interface TopologyDevice {
  address: number;      // 回路设备地址 1-250
  id: string;           // 格式: CTRL{addr}-MOD{index}-L{loop}-{deviceAddr}
  name: string;
  type: "smoke" | "temperature" | "manual" | "monitor" | "control";
  status: DeviceStatus;
  value?: number;
  unit?: string;
  lastSeen?: string;
}

export interface FireLoop {
  loopNumber: number;   // 回路号 (例如 1, 2)
  devices: { [address: number]: TopologyDevice }; // 挂载的设备
}

export interface LoopModule {
  id: string;
  index: number;        // 模块序号, 比如 1#模块, 2#模块
  name: string;
  status: "online" | "offline";
  loops: FireLoop[];    // 支持两个回路
}

export interface ControllerNode {
  id: string;
  address: number;      // 控制器物理地址
  name: string;
  status: "online" | "offline";
  modules: LoopModule[];
}
```

### 2. 状态存储扩展 (`src/store/useFireStore.ts`)
- 保存控制器拓扑数据 `controllers: ControllerNode[]`。
- 新增当前选中的控制器 `selectedControllerId`，模块 `selectedModuleId`，回路号 `selectedLoopNumber`，以及选中的设备地址 `selectedTopologyAddr`。
- 新增更新回路设备遥测状态、触发报警/故障、复位设备的 actions。

---

## 拟修改的组件与文件

### 1. [MODIFY] `src/types.ts`
- 扩充 `PageKey` 与拓扑接口定义。

### 2. [MODIFY] `src/data/mock.ts`
- 生成模拟控制器数据（例如 3 个控制器，控制器 1 拥有 2 个模块，其余控制器拥有 1 个模块）。
- 为每个回路初始化挂载的部分设备（1-125 区间随机分布烟温探测器，126-250 区间随机分布手报、控制模块）。其余未挂载的地址标记为空（可配置）。

### 3. [MODIFY] `src/store/useFireStore.ts`
- 管理拓扑的状态和修改逻辑。
- 允许通过 `telemetry:updated` 对拓扑里的设备进行数值更新。

### 4. [MODIFY] `src/simulator/simulator.ts`
- 扩展模拟器，在 tick 周期中对拓扑中的所有已配置设备也进行遥测变化模拟（温度与烟雾数值上下波动，随机产生故障/报警状态，并按概率触发系统级告警）。

### 5. [NEW] `src/components/LoopTopology.tsx`
- **视图一：网络拓扑图 (SVG)**
  - 用精美的 SVG 渲染控制器间的环形/总线网络结构。
  - 点击控制器节点可展开展示其连接的“模块” -> “回路”，包含状态高亮、信号流动画与告警闪烁。
- **视图二：回路设备物理拓扑**
  - **筛选与搜索**：支持设备类型过滤、在线/告警/故障状态过滤、地址搜索。
  - **地址表盘网格 (Address Matrix Grid)**：展示 1 - 250 地址。
    - 划分为左右/上下两个大区域（1-125 探测器区，126-250 模块与按钮区）。
    - 每个单元格用小方格表示，鼠标悬浮显示简要信息，点击展开侧边详细面板。
    - 方格根据状态以不同颜色呼吸发光（绿色在线、红色报警、黄色故障/警告、蓝色离线、灰色空闲未挂载）。
  - **设备交互面板**：可在右侧面板查看设备详情，并支持手动模拟“触发告警”、“触发故障”、“设备复位”按钮，立即影响模拟器与全局状态。

### 6. [MODIFY] `src/App.tsx`
- 在侧边栏导航添加“回路拓扑”菜单，并配置 Lucide 图标。

### 7. [MODIFY] `src/styles.css`
- 添加专用于拓扑页面的现代化暗黑科幻风 CSS。包含：
  - SVG 连线流光动画。
  - 250 地址格子的流式网格，自适应分辨率。
  - 控制面板的高级玻璃质感毛玻璃效果。

---

## 验证计划

### 1. 编译验证
- 运行 `npm run typecheck` 确认 TypeScript 类型无误。
- 运行 `npm run build` 确认项目可以正常构建。

### 2. 功能与交互验证
- 验证侧边栏是否正常切换至“回路拓扑”页面。
- 在“网络拓扑”标签下，验证 SVG 拓扑图的连线、节点高亮、动画与点击下钻是否正常。
- 在“回路物理拓扑”标签下，验证切换不同控制器、不同模块、两个回路时，250 地址网格更新是否准确。
- 验证地址 1-125 区间仅有探测器，126-250 区间仅有手报/控制监视模块。
- 验证点击网格中不同的设备，右侧详情栏信息正确更新。
- 点击“模拟告警”/“模拟故障”/“复位”，确认对应的网格状态和数值变化，并观察告警中心是否产生对应新告警。
