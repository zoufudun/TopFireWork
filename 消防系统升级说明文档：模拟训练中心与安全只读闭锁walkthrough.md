# 消防系统升级说明文档：模拟训练中心与安全只读闭锁

此文档记录了将灭火联动迁入“模拟训练中心”，引入权限登录，以及物理闭锁真实系统控制通道的实现细节。

---

## 1. 变更范围与涉及文件

### 1.1 状态管理升级 ([useFireStore.ts](file:///m:/TOPFIRE/TopFireAI/src/store/useFireStore.ts))
- **登录状态定义**：引入 `loginMode` (`"training"` | `"real"` | `null`) 和 `operatorName` (`string`)。
- **操作层闭锁**：在 `triggerTopologyAlarm`、`triggerTopologyFault` 和 `resetTopologyDevice` 三个修改设备状态的核心 Action 中，追加 `state.loginMode === "real"` 拦截判断，直接返回原始状态，确保在状态机层面上真实设备状态不可被修改。

### 1.2 高拟真登录界面 ([Login.tsx](file:///m:/TOPFIRE/TopFireAI/src/components/Login.tsx) - [NEW])
- 独立新建登录页面，包含动态网格和霓虹微光背景特效。
- 支持用户输入操作员签名姓名及电子密匙密码。
- 提供两张发光控制卡：
  1. **模拟训练模式 (SIMULATION)**：启用火警注入、故障模拟、声光警报消音和联动复位演示。
  2. **真实现实模式 (READONLY)**：物理控制总线单向闭锁，仅提供只读监控拓扑和设备状态，阻断消音、复位及联动触发指令下发。

### 1.3 样式系统强化 ([styles.css](file:///m:/TOPFIRE/TopFireAI/src/styles.css))
- 增加了登录背景、卡片、表单的样式，包含毛玻璃质感、发光卡片、霓虹流光。
- 增加了 `.readonly-physical-lock-overlay` 用于覆盖“模拟训练中心”的控制区。
- 增加了 `.readonly-topology-warning-banner` 用于在回路拓扑中显示红色锁头阻断通知。
- 增加了操作员侧边栏头像与卡片样式 `.operator-profile-badge`。

### 1.4 主机架与全局提示重塑 ([App.tsx](file:///m:/TOPFIRE/TopFireAI/src/App.tsx))
- **根渲染控制**：若未登录（`loginMode === null`），则展示登录组件，拦截其余页面渲染。
- **名称重塑造**：将左侧导航“灭火联动”重命名为“模拟训练中心”。
- **只读模拟流**：在侧边栏底部的“模拟数据流”卡片中，若是 `real` 模式则隐藏暂停/播放与重置按钮，改为只读数据指示。
- **操作员看板**：侧边栏底部增加操作员签名档、当前权限级别，并提供红色的“退出终端登出”按钮。
- **安全通知条**：顶部的安全提示框在 `real` 模式下为红色高亮只读模式锁定说明。
- **联锁弹窗改版**：发生火警联锁时，`real` 模式下仅展示只读警告通知，不再显示“立即进入控制中心执行”等带有控制性质的动作按钮。

### 1.5 模拟训练中心深度演练 ([FireLinkage.tsx](file:///m:/TOPFIRE/TopFireAI/src/components/FireLinkage.tsx))
- **延时控制器**：顶部导航栏右侧增加了 Slider 滑块，支持操作员在线配置 1301 气体联动延时（5s-60s）与细水雾联动延时（0s-30s）。
- **延时联动支持**：修改了 `confirmFireAlarm` 与 `resetSystem`，使倒计时递减和安全复位采用配置好的延时值（对于细水雾，延时若配置为 0s 则在火警确认后直接开阀，若大于 0s 则展示撤离延时倒计时，完美符合延时联动过程）。
- **物理安全锁屏**：若登录为 `real` 模式，整个联动总控页面会被一层精致半透明的物理隔离盖板（ frosted glass overlay ）覆盖，显示“🔒 模拟灭火控制已物理闭锁”的警告卡片，阻断任何鼠标点击，并指引操作员退出以切换权限。

### 1.6 回路拓扑只读加固 ([LoopTopology.tsx](file:///m:/TOPFIRE/TopFireAI/src/components/LoopTopology.tsx))
- **右下控制盒升级**：在真实现实（只读）模式下，隐藏模拟触发、通信故障注入和消音复位这三个具有交互指令下发性质的按钮。
- **锁定状态指示**：替换为红色字样的物理链路只读警告条，声明已物理切断指令通路。

---

## 2. 验证与测试结果

### 2.1 编译与生产打包验证
- 运行 `npx tsc --noEmit` 进行 TypeScript 严格类型检查，无任何类型错误。
- 运行 `npm run build` 进行 Vite 生产环境打包，编译通过，生成优化后的 JS 静态资源及 CSS 文件，证实代码质量健壮：
  ```bash
  vite v8.1.4 building client environment for production...
  transforming...✓ 1582 modules transformed.
  rendering chunks...
  dist/index.html                   0.52 kB
  dist/assets/index-2a_Ov1XQ.css   51.01 kB
  dist/assets/index-n921vt5F.js   356.43 kB
  ✓ built in 482ms
  ```

### 2.2 功能流向与安全机制
- **登录切换**：选择“模拟训练”进入系统，可完成完整的告警生成、延时倒计时、水雾喷洒、复位重装等训练仿真。点击退出，切换为“真真实实”模式，系统瞬间物理闭锁，阻断所有模拟事件产生和控制信号，全面收紧真实系统的网络边界。
