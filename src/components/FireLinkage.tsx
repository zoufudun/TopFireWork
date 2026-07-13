import {
  CheckCircle2,
  Clock3,
  Play,
  RotateCcw,
  ShieldAlert,
  Flame,
  AlertTriangle,
  Info,
  RadioTower,
  Square,
  Volume2,
  VolumeX,
  Check,
  Zap
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { eventBus } from "../events/eventBus";

type ExtinguishMethod = "1301" | "mist";
type LinkageMode = "auto" | "manual";
type LinkageStatus =
  | "safe"         // 安全就绪
  | "alarmed"      // 火警触发（声报警启动）
  | "confirming"   // 等待人工火警确认
  | "counting"     // 倒计时阶段（1301气体为25秒，细水雾为5秒）
  | "valves"       // 阀门开启动画阶段
  | "pump"         // 水泵启动阶段 (仅细水雾)
  | "spraying"     // 释放喷洒中
  | "aborted";     // 紧急停止中止

export function FireLinkage() {
  const [method, setMethod] = useState<ExtinguishMethod>("1301");
  const [mode, setMode] = useState<LinkageMode>("auto");
  const [status, setStatus] = useState<LinkageStatus>("safe");
  const [countdown, setCountdown] = useState(25);
  const [cylinderPressure, setCylinderPressure] = useState(2.0); // MPa
  const [inPressure, setInPressure] = useState(2.4);             // MPa
  const [outPressure, setOutPressure] = useState(0.0);            // MPa

  // 子页面选项卡控制与储存站气压状态
  const [activeSubTab, setActiveSubTab] = useState<"control" | "stations" | "zones">("control");
  const [selectedStation, setSelectedStation] = useState<"A" | "B" | "C">("A");
  const [pressuresA, setPressuresA] = useState<number[]>([2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0]);
  const [pressuresB, setPressuresB] = useState<number[]>([15.0, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2]);
  const [pressuresC, setPressuresC] = useState<number[]>([2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0]);

  // 动画与报警状态 flags
  const [valveOpeningProgress, setValveOpeningProgress] = useState(0); // 分配阀开启百分比 (0-100)
  const [isMuted, setIsMuted] = useState(true);                        // 音频声源默认静音
  const [showInterlockPrompt, setShowInterlockPrompt] = useState(false); // 弹出“火警联锁驱动中”提示层
  const [triggeredAlarmSource, setTriggeredAlarmSource] = useState(""); // 触发警报设备名称说明

  // 优化状态机：将声光报警与声警报改为由运行状态 status 派生的状态，消除多余状态与不同步问题
  const soundAlarmActive = status !== "safe" && status !== "aborted";
  const sirenActive = status === "pump" || status === "spraying";

  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepIntervalRef = useRef<number | null>(null);

  // 硬件状态判定
  const selectorValveOpen = valveOpeningProgress >= 90;
  const zoneValveOpen = status === "spraying" || status === "pump" || status === "valves";
  const pumpActive = method === "mist" && (status === "pump" || status === "spraying");
  const sprayingActive = status === "spraying";

  // 根据手段切换，初始化默认压力和倒计时
  useEffect(() => {
    if (status === "safe") {
      if (method === "1301") {
        setCountdown(25);
        setCylinderPressure(2.0); // 1301气体满瓶为 2.0 MPa
      } else {
        setCountdown(5);
        setCylinderPressure(4.2); // 细水雾初始氮气稳压为 4.2 MPa
      }
    }
  }, [method, status]);

  // 监听真实回路设备的火警事件，自动触发联动控制逻辑
  useEffect(() => {
    const handleAlarmCreated = (payload: any) => {
      const alarm = payload.alarm;
      if (!alarm) return;

      // 只要是火警或者烟雾、温度异常高（等级 level 1 表示火灾）
      const isFireAlarm = alarm.level === 1 || 
                          alarm.title.includes("火警") || 
                          alarm.title.includes("火灾") || 
                          alarm.description.includes("火警") ||
                          alarm.description.includes("火灾");

      if (isFireAlarm && status === "safe") {
        // 若该回路设备明确标记为不需要联动灭火，则跳过联动触发流程
        if (alarm.needLinkage === false) {
          return;
        }

        // 根据属性决定联动灭火采用的灭火手段，若属性未定义则按楼层规则推断 (B1电气->1301, F2/F3办公->细水雾)
        let targetMethod: ExtinguishMethod = alarm.floorId === "B1" ? "1301" : "mist";
        if (alarm.needLinkage === true && alarm.linkageType) {
          targetMethod = alarm.linkageType;
        }

        setMethod(targetMethod);
        
        // 自动将系统切换到火警触发状态
        setStatus("alarmed");
        
        // 如果是自动模式，直接进入等待人工火警确认状态
        if (mode === "auto") {
          setStatus("confirming");
        }

        // 弹窗提示操作员发生了火警联动，引导其处理或查看
        setTriggeredAlarmSource(`${alarm.source} (${alarm.title}, 保护区: ${targetMethod === "1301" ? "1301气体灭火区" : "高压细水雾区"})`);
        setShowInterlockPrompt(true);
      }
    };

    eventBus.on("alarm:created", handleAlarmCreated);
    return () => {
      eventBus.off("alarm:created", handleAlarmCreated);
    };
  }, [status, mode]);

  // 声报警 Web Audio 合成音效（模拟消防蜂鸣警报器）
  useEffect(() => {
    if (soundAlarmActive && !isMuted) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sawtooth"; // 锯齿波更加尖锐醒目
        osc.frequency.setValueAtTime(650, ctx.currentTime);

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();

        let beepOn = false;
        const intervalId = window.setInterval(() => {
          if (ctx.state === "suspended") {
            ctx.resume();
          }
          beepOn = !beepOn;
          // 倒计时阶段或释放阶段警报更急促
          const isUrgent = status === "counting" || status === "spraying";
          if (beepOn) {
            osc.frequency.setValueAtTime(isUrgent ? 850 : 650, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
          } else {
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
          }
        }, status === "counting" ? 200 : 400);

        beepIntervalRef.current = intervalId;

        return () => {
          clearInterval(intervalId);
          try {
            osc.stop();
          } catch(e){}
          ctx.close();
        };
      } catch (err) {
        console.warn("Web Audio API not supported or blocked", err);
      }
    }
  }, [soundAlarmActive, isMuted, status]);

  // 1. 自动倒计时时钟：只在进入 counting 状态时启动一个计时器，避免重复销毁创建
  useEffect(() => {
    if (status !== "counting") return;

    const timer = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  // 2. 倒计时状态机跳转：依赖 countdown 的变化独立响应
  useEffect(() => {
    if (status === "counting") {
      if (countdown === 0) {
        setStatus("valves");
        setValveOpeningProgress(0);
      } else {
        // 按照细水雾阶段化设计：25秒倒计时撤离期间，阀门并不开启，待倒计时归零后才驱动分配阀
        setValveOpeningProgress(0);
      }
    }
  }, [countdown, status]);

  // 3. 细水雾及气体喷洒工艺动画控制
  useEffect(() => {
    let timer: number;
    let valveInterval: number;
    if (status === "valves") {
      setOutPressure(method === "1301" ? 0.6 : 0.8);
      setValveOpeningProgress(0);
      let prog = 0;
      valveInterval = window.setInterval(() => {
        prog += 10;
        setValveOpeningProgress(prog);
        if (prog >= 100) {
          clearInterval(valveInterval);
        }
      }, 150);

      timer = window.setTimeout(() => {
        setStatus("pump");
      }, 2000);
    } else if (status === "pump") {
      setOutPressure(method === "1301" ? 1.2 : 1.8);
      timer = window.setTimeout(() => {
        setStatus("spraying");
      }, 2500);
    } else if (status === "spraying") {
      if (method === "1301") {
        // 1301气体钢瓶释放，压力从 2.0MPa 快速滑落至 0MPa，气体喷洒充装
        setOutPressure(2.0);
        const interval = window.setInterval(() => {
          setCylinderPressure((p) => {
            if (p > 0.15) {
              return parseFloat((p - 0.2).toFixed(1));
            }
            clearInterval(interval);
            return 0.0;
          });
        }, 150);
        return () => clearInterval(interval);
      } else {
        // 细水雾喷洒，稳压罐压力稍微下降，但高压水泵持续加压提供 2.3MPa 的高压细水雾
        setOutPressure(2.3);
        const interval = window.setInterval(() => {
          setCylinderPressure((p) => {
            if (p > 2.0) {
              return parseFloat((p - 0.15).toFixed(2));
            }
            return p;
          });
        }, 300);
        return () => clearInterval(interval);
      }
    }
    return () => {
      clearTimeout(timer);
      clearInterval(valveInterval);
    };
  }, [status, method]);

  // --- 操作控制指令 ---

  // 发生火警触发
  function triggerFireSim() {
    setStatus("alarmed");

    if (method === "1301") {
      if (mode === "auto") {
        // 1301气体自动模式：需要人工确认火警
        setStatus("confirming");
      } else {
        // 手动模式：处于火警触发状态，声报警开启，等待操作员点击“手动紧急启动”
      }
    } else {
      // 细水雾模式：自动模式下火警触发也进入“人工确认火警”状态
      if (mode === "auto") {
        setStatus("confirming");
      } else {
        // 手动模式：等待操作员手动启动
      }
    }
  }

  // 人工确认火警
  function confirmFireAlarm() {
    if (status === "confirming") {
      if (method === "1301") {
        setStatus("counting");
        setCountdown(25);
      } else {
        // 细水雾：火警确认后，不需要倒计时，直接进入开阀状态 (valves)
        setStatus("valves");
      }
    }
  }

  // 手动/自动紧急启动
  function triggerManualRelease() {
    setValveOpeningProgress(100);

    if (method === "1301") {
      // 1301气体：跳过倒计时，直接开启分配阀与钢瓶释放
      setStatus("spraying");
    } else {
      // 细水雾：直接进入开阀动作
      setStatus("valves");
    }
  }

  // 紧急终止释放
  function abortRelease() {
    setStatus("aborted");
    setOutPressure(0.0);
  }

  // 储存站钢瓶释放气压衰减时序
  useEffect(() => {
    let interval: number;
    if (status === "spraying") {
      if (method === "1301") {
        // 1301气体释放：衰减灭火站A的7个钢瓶压力 (1# ZS40 和 2-7# ZS85)
        interval = window.setInterval(() => {
          setPressuresA((prev) => prev.map((p) => Math.max(0, parseFloat((p - 0.25).toFixed(2)))));
        }, 150);
      } else {
        // 细水雾释放：衰减灭火站B的驱动钢瓶压力 (1# ZS40 启动气瓶从 15MPa 降到 0，2-7# 从 4.2MPa 降到 2.0MPa 稳压)
        interval = window.setInterval(() => {
          setPressuresB((prev) => prev.map((p, i) => {
            if (i === 0) return Math.max(0, parseFloat((p - 1.5).toFixed(2)));
            return Math.max(2.0, parseFloat((p - 0.25).toFixed(2))); // 保持在 2.0 MPa 稳压
          }));
        }, 150);
      }
    }
    return () => clearInterval(interval);
  }, [status, method]);

  // 联动安全复位
  function resetSystem() {
    setStatus("safe");
    setValveOpeningProgress(0);
    setOutPressure(0.0);
    setPressuresA([2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0]);
    setPressuresB([15.0, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2]);
    setPressuresC([2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0]);
    if (method === "1301") {
      setCountdown(25);
      setCylinderPressure(2.0);
    } else {
      setCountdown(0); // 细水雾没有倒计时
      setCylinderPressure(4.2);
    }
  }

  return (
    <section className="linkage-workbench" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <style dangerouslySetInnerHTML={{
        __html: `
        /* 联动控制中心专用动效样式 */
        .linkage-panel-grid {
          display: grid;
          grid-template-columns: 330px 1fr;
          gap: 20px;
        }

        .linkage-status-panel {
          background: linear-gradient(135deg, rgba(14, 28, 48, 0.95) 0%, rgba(6, 14, 26, 0.98) 100%);
          border: 1.5px solid rgba(77, 231, 255, 0.2);
          border-radius: 14px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        }

        /* 极美呼吸光与发光倒计时 */
        .countdown-glow {
          font-size: 42px;
          font-weight: 900;
          font-family: monospace;
          color: #ff4d5e;
          text-shadow: 0 0 12px rgba(255, 77, 94, 0.8), 0 0 24px rgba(255, 77, 94, 0.4);
          animation: textPulse 1s infinite alternate;
        }

        @keyframes textPulse {
          from { transform: scale(0.98); opacity: 0.85; }
          to { transform: scale(1.02); opacity: 1; }
        }

        /* 硬件卡片排版 */
        .hardware-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 16px;
        }

        .hardware-card {
          background: rgba(14, 28, 48, 0.6);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .hardware-card:hover {
          border-color: rgba(77, 231, 255, 0.25);
          background: rgba(14, 28, 48, 0.85);
          transform: translateY(-2px);
        }

        .hardware-card.bypassed {
          opacity: 0.25;
          filter: grayscale(80%) blur(0.5px);
          cursor: not-allowed;
          pointer-events: none;
        }

        .hardware-card.bypassed::after {
          content: '系统旁路/未启用';
          position: absolute;
          bottom: 12px;
          background: rgba(0,0,0,0.85);
          color: var(--muted);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: bold;
          border: 1px solid rgba(255,255,255,0.05);
        }

        .hardware-title {
          font-size: 12px;
          font-weight: bold;
          color: var(--cyan);
          text-align: center;
          width: 100%;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          padding-bottom: 6px;
        }

        .h-visual {
          width: 120px;
          height: 120px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* 声光报警器 Dome 旋转扫射动画 */
        @keyframes rotatingLight {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* 气瓶气体云粒子扩散动画 */
        .gas-cloud {
          position: absolute;
          top: 15px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(240, 240, 255, 0.6);
          filter: blur(2px);
          animation: releaseGas 1.2s infinite ease-out;
        }

        @keyframes releaseGas {
          0% { transform: translateY(0) scale(1) translateX(0); opacity: 0; }
          10% { opacity: 0.8; }
          100% { transform: translateY(-45px) scale(5) translateX(var(--drift, 0px)); opacity: 0; }
        }

        /* 音源声波扩散动画 */
        .audio-wave-panel {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 18px;
          width: 32px;
        }

        .wave-bar {
          flex: 1;
          background: var(--red);
          border-radius: 1px;
          height: 3px;
          transition: height 0.15s ease;
        }

        .audio-wave-panel.active .wave-bar {
          animation: waveJump 0.6s infinite alternate;
        }

        .audio-wave-panel.active .wave-bar:nth-child(2) { animation-delay: 0.15s; }
        .audio-wave-panel.active .wave-bar:nth-child(3) { animation-delay: 0.3s; }
        .audio-wave-panel.active .wave-bar:nth-child(4) { animation-delay: 0.05s; }

        @keyframes waveJump {
          from { height: 2px; }
          to { height: 18px; }
        }

        /* 声光防爆警铃灯闪烁 */
        @keyframes flashBeacon {
          from { opacity: 0.2; }
          to { opacity: 1; }
        }

        /* 阀门开启时的发光脉冲 */
        @keyframes pulseGlow {
          from { filter: drop-shadow(0 0 2px rgba(77, 231, 255, 0.4)); opacity: 0.5; }
          to { filter: drop-shadow(0 0 10px rgba(77, 231, 255, 0.95)); opacity: 1; }
        }

        @keyframes spinPropeller {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* 气流流动条 */
        .flow-line {
          position: absolute;
          height: 2px;
          background: var(--cyan);
          box-shadow: 0 0 4px var(--cyan);
          animation: flowAnim 1.5s infinite linear;
        }

        @keyframes flowAnim {
          0% { left: 0%; width: 0%; opacity: 0; }
          50% { left: 30%; width: 40%; opacity: 1; }
          100% { left: 100%; width: 0%; opacity: 0; }
        }

        @keyframes flowMove {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
      ` }} />

      {/* 联动中心子工作区选项卡 */}
      <div style={{
        display: "flex",
        background: "rgba(0, 0, 0, 0.45)",
        padding: "4px",
        borderRadius: "10px",
        border: "1px solid var(--line)",
        alignSelf: "flex-start",
        gap: "4px",
        backdropFilter: "blur(12px)",
        boxShadow: "0 4px 15px rgba(0,0,0,0.25)",
        marginBottom: "6px"
      }}>
        <button
          onClick={() => setActiveSubTab("control")}
          style={{
            background: activeSubTab === "control" ? "rgba(77, 231, 255, 0.15)" : "transparent",
            color: activeSubTab === "control" ? "var(--cyan)" : "var(--muted)",
            border: activeSubTab === "control" ? "1px solid rgba(77, 231, 255, 0.25)" : "1px solid transparent",
            borderRadius: "7px",
            fontSize: "11.5px",
            padding: "8px 18px",
            cursor: "pointer",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s"
          }}
        >
          <RadioTower size={13} />
          联动控制中心
        </button>
        <button
          onClick={() => setActiveSubTab("stations")}
          style={{
            background: activeSubTab === "stations" ? "rgba(77, 231, 255, 0.15)" : "transparent",
            color: activeSubTab === "stations" ? "var(--cyan)" : "var(--muted)",
            border: activeSubTab === "stations" ? "1px solid rgba(77, 231, 255, 0.25)" : "1px solid transparent",
            borderRadius: "7px",
            fontSize: "11.5px",
            padding: "8px 18px",
            cursor: "pointer",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s"
          }}
        >
          <Flame size={13} />
          灭火剂储存站监视
        </button>
        <button
          onClick={() => setActiveSubTab("zones")}
          style={{
            background: activeSubTab === "zones" ? "rgba(77, 231, 255, 0.15)" : "transparent",
            color: activeSubTab === "zones" ? "var(--cyan)" : "var(--muted)",
            border: activeSubTab === "zones" ? "1px solid rgba(77, 231, 255, 0.25)" : "1px solid transparent",
            borderRadius: "7px",
            fontSize: "11.5px",
            padding: "8px 18px",
            cursor: "pointer",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s"
          }}
        >
          <ShieldAlert size={13} />
          防护区管网监测
        </button>
      </div>

      {activeSubTab === "control" && (
        <>
          {/* 顶部灭火控制台导航与参数选择 */}
          <div style={{
        background: "rgba(10, 24, 44, 0.65)",
        border: "1px solid var(--line)",
        borderRadius: "14px",
        padding: "16px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px",
        backdropFilter: "blur(12px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <RadioTower size={24} className="text-cyan" style={{ animation: status !== "safe" && status !== "aborted" ? "flash 0.8s infinite alternate" : "none" }} />
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", color: "#fff", fontWeight: "bold" }}>联动控制器参数面板</h2>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>配置防护区的灭火介质形态及逻辑触发时序</span>
          </div>
        </div>

        {/* 控制配置项 */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          {/* 1. 灭火手段 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "var(--muted)", fontWeight: "bold" }}>灭火手段介质</label>
            <div style={{ display: "flex", background: "rgba(0,0,0,0.4)", padding: "3px", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <button
                onClick={() => { if (status === "safe") setMethod("1301"); }}
                disabled={status !== "safe"}
                style={{
                  background: method === "1301" ? "var(--cyan)" : "transparent",
                  color: method === "1301" ? "#000" : "var(--muted)",
                  border: 0, borderRadius: "6px", fontSize: "11px", padding: "5px 12px", cursor: status === "safe" ? "pointer" : "not-allowed", fontWeight: "bold"
                }}
              >
                1301 气体灭火
              </button>
              <button
                onClick={() => { if (status === "safe") setMethod("mist"); }}
                disabled={status !== "safe"}
                style={{
                  background: method === "mist" ? "var(--cyan)" : "transparent",
                  color: method === "mist" ? "#000" : "var(--muted)",
                  border: 0, borderRadius: "6px", fontSize: "11px", padding: "5px 12px", cursor: status === "safe" ? "pointer" : "not-allowed", fontWeight: "bold"
                }}
              >
                高压细水雾灭火
              </button>
            </div>
          </div>

          {/* 2. 联动模式 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "var(--muted)", fontWeight: "bold" }}>联动触发模式</label>
            <div style={{ display: "flex", background: "rgba(0,0,0,0.4)", padding: "3px", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <button
                onClick={() => { if (status === "safe") setMode("auto"); }}
                disabled={status !== "safe"}
                style={{
                  background: mode === "auto" ? "var(--cyan)" : "transparent",
                  color: mode === "auto" ? "#000" : "var(--muted)",
                  border: 0, borderRadius: "6px", fontSize: "11px", padding: "5px 12px", cursor: status === "safe" ? "pointer" : "not-allowed", fontWeight: "bold"
                }}
              >
                自动模式 (AUTO)
              </button>
              <button
                onClick={() => { if (status === "safe") setMode("manual"); }}
                disabled={status !== "safe"}
                style={{
                  background: mode === "manual" ? "var(--cyan)" : "transparent",
                  color: mode === "manual" ? "#000" : "var(--muted)",
                  border: 0, borderRadius: "6px", fontSize: "11px", padding: "5px 12px", cursor: status === "safe" ? "pointer" : "not-allowed", fontWeight: "bold"
                }}
              >
                手动模式 (MAN)
              </button>
            </div>
          </div>

          {/* 3. 音视频声警报控制 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "var(--muted)", fontWeight: "bold" }}>物理声警报音效</label>
            <button
              onClick={() => setIsMuted(!isMuted)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: isMuted ? "rgba(255,255,255,0.05)" : "rgba(255, 77, 94, 0.15)",
                border: isMuted ? "1px solid var(--line)" : "1px solid rgba(255, 77, 94, 0.3)",
                borderRadius: "8px",
                color: isMuted ? "var(--muted)" : "#ff4d5e",
                padding: "6px 12px",
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} style={{ animation: "flash 0.5s infinite alternate" }} />}
              <span>{isMuted ? "已静音模拟" : "物理声警报开"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 主面板 Grid：左侧控制台，右侧状态机与硬件监视 */}
      <div className="linkage-panel-grid">
        {/* 左侧控制面板 */}
        <div className="linkage-status-panel">
          <div>
            <span style={{ fontSize: "10px", fontWeight: "bold", color: "var(--cyan)", letterSpacing: "0.15em" }}>FIRE SUPPRESSION PANEL</span>
            <h3 style={{ margin: "2px 0 0 0", color: "#fff", fontSize: "16px" }}>气体/细水雾联动总控</h3>
          </div>

          {/* 状态看板 */}
          <div style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--line)",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>系统当前运行状态:</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {status === "safe" && <span style={{ color: "var(--green)", fontWeight: "bold", fontSize: "14px" }}>🟢 监测监视运行正常</span>}
              {status === "alarmed" && <span style={{ color: "var(--red)", fontWeight: "bold", fontSize: "14px", animation: "flash 0.8s infinite alternate" }}>🚨 火警报警·声控开启</span>}
              {status === "confirming" && <span style={{ color: "var(--amber)", fontWeight: "bold", fontSize: "14px", animation: "flash 0.5s infinite alternate" }}>⚠️ 等待人工火警确认...</span>}
              {status === "counting" && <span style={{ color: "var(--red)", fontWeight: "bold", fontSize: "14px" }}>⏳ 防护区撤离延时中</span>}
              {status === "valves" && <span style={{ color: "var(--amber)", fontWeight: "bold", fontSize: "14px" }}>⚙️ 管网阀组驱动开启中</span>}
              {status === "pump" && <span style={{ color: "var(--amber)", fontWeight: "bold", fontSize: "14px" }}>⚡ 灭火高压泵组联锁启动</span>}
              {status === "spraying" && <span style={{ color: "#ff4d5e", fontWeight: "bold", fontSize: "14.5px", animation: "flash 0.4s infinite alternate" }}>🔥 灭火药剂喷洒释放中</span>}
              {status === "aborted" && <span style={{ color: "var(--muted)", fontWeight: "bold", fontSize: "14px" }}>🛑 紧急中止·控制闭锁</span>}
            </div>

            {/* 警报类型标注 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "6px", marginTop: "4px" }}>
              <span style={{ fontSize: "10.5px", color: "var(--muted)" }}>介质: {method === "1301" ? "1301氟代烷气体" : "高压水雾"}</span>
              <span style={{ fontSize: "10.5px", color: "var(--muted)" }}>逻辑: {mode === "auto" ? "全自动联动" : "点控手动"}</span>
            </div>
          </div>

          {/* 声报警状态面板 */}
          {(status !== "safe" && status !== "aborted") && (
            <div style={{
              background: "rgba(255, 77, 94, 0.05)",
              border: "1px solid rgba(255, 77, 94, 0.15)",
              borderRadius: "10px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              animation: "fadeIn 0.3s"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="led-flash-alarm" style={{ width: "8px", height: "8px", background: "var(--red)", borderRadius: "50%", display: "inline-block" }} />
                <span style={{ fontSize: "11px", color: "#ff8894", fontWeight: "bold" }}>声报警音响呼叫已开启</span>
              </div>
              <div className="audio-wave-panel active">
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
                <span className="wave-bar" />
              </div>
            </div>
          )}

          {/* 大倒计时气泡看板 */}
          {(status === "counting" || status === "spraying") && (
            <div style={{
              background: status === "spraying" ? "rgba(255, 77, 94, 0.15)" : "rgba(255, 77, 94, 0.08)",
              border: "1.5px solid rgba(255, 77, 94, 0.35)",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              animation: "fadeIn 0.3s ease-out"
            }}>
              <span style={{ fontSize: "11px", color: "#ff8894", fontWeight: "bold" }}>
                {status === "spraying" ? "灭火药剂正在全力喷洒" : "防护区人员紧急撤离延时"}
              </span>
              <div className="countdown-glow">
                {status === "counting" ? `${countdown.toString().padStart(2, "0")}s` : "00s"}
              </div>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                {method === "1301" ? "1301电磁钢瓶释放阀倒计时" : "细水雾泄压倒计时"}
              </span>
            </div>
          )}

          {/* 操作按钮区 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
            
            {/* 1. 模拟火警触发 */}
            <button
              onClick={triggerFireSim}
              disabled={status !== "safe" && status !== "aborted"}
              style={{
                background: "rgba(255, 77, 94, 0.12)",
                border: "1px solid rgba(255, 77, 94, 0.3)",
                color: "#ff4d5e",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "12.5px",
                fontWeight: "bold",
                cursor: (status !== "safe" && status !== "aborted") ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s"
              }}
            >
              <Flame size={15} style={{ animation: status === "confirming" ? "pulse 0.5s infinite" : "none" }} /> 
              模拟防护区火警触发
            </button>

            {/* 2. 人工确认火警 (仅在1301自动模式火警后需要) */}
            {status === "confirming" && (
              <button
                onClick={confirmFireAlarm}
                style={{
                  background: "linear-gradient(90deg, #ff4d5e 0%, #ff8894 100%)",
                  border: "1.5px solid #ff4d5e",
                  color: "#000",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  fontSize: "13px",
                  fontWeight: "900",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  animation: "pulseRedDot 0.8s infinite alternate",
                  boxShadow: "0 0 15px rgba(255, 77, 94, 0.6)"
                }}
              >
                <Check size={16} strokeWidth={3} /> 人工确认火警真实性
              </button>
            )}

            {/* 3. 手动紧急启动 */}
            <button
              onClick={triggerManualRelease}
              disabled={status === "spraying" || status === "valves" || status === "pump" || (method === "1301" && status === "counting")}
              style={{
                background: "rgba(77, 231, 255, 0.12)",
                border: "1px solid rgba(77, 231, 255, 0.3)",
                color: "var(--cyan)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "12.5px",
                fontWeight: "bold",
                cursor: (status === "spraying" || status === "valves" || status === "pump" || (method === "1301" && status === "counting")) ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s"
              }}
            >
              <Zap size={14} /> 手动紧急控制释放
            </button>

            {/* 4. 紧急停止 */}
            <button
              onClick={abortRelease}
              disabled={status === "safe" || status === "aborted" || status === "spraying"}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--line)",
                color: "#fff",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "12.5px",
                fontWeight: "bold",
                cursor: (status === "safe" || status === "aborted" || status === "spraying") ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s"
              }}
            >
              <Square size={14} /> 紧急终止药剂释放
            </button>

            {/* 5. 联动安全复位 */}
            <button
              onClick={resetSystem}
              style={{
                background: "rgba(55, 242, 193, 0.12)",
                border: "1px solid rgba(55, 242, 193, 0.3)",
                color: "var(--green)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "12.5px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s"
              }}
            >
              <RotateCcw size={14} /> 联动闭锁安全复位
            </button>
          </div>
        </div>

        {/* 右侧流程展示与硬件反馈 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Stepper Pipeline Flow */}
          <div className="stepper-container" style={{ padding: method === "1301" ? "20px 20px" : "24px 20px" }}>
            <h4 style={{ margin: "0 0 6px 0", fontSize: "12px", color: "var(--cyan)", fontWeight: "bold" }}>
              {method === "1301" ? "1301 气体自动喷洒时序图 (现场监控状态机)" : "高压细水雾喷淋工艺流程控制图"}
            </h4>

            {method === "1301" ? (
              /* 1301 气体自动喷洒时序图 (SVG 动画图形) */
              <div style={{ marginTop: "12px", position: "relative", width: "100%", overflowX: "auto" }}>
                <svg width="100%" height="160" viewBox="0 0 540 160" style={{ overflow: "visible", minWidth: "500px" }}>
                  <defs>
                    <radialGradient id="lineCursorGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgba(255, 77, 94, 0.4)" />
                      <stop offset="100%" stopColor="rgba(255, 77, 94, 0)" />
                    </radialGradient>
                  </defs>

                  {/* 时序背景背板 */}
                  <rect x="0" y="0" width="536" height="152" fill="rgba(10, 24, 44, 0.3)" rx="8" stroke="rgba(77, 231, 255, 0.1)" strokeWidth="1" />

                  {/* 时序竖向虚线分割线 */}
                  <line x1="120" y1="8" x2="120" y2="136" stroke="rgba(255,255,255,0.08)" strokeDasharray="3" />
                  <line x1="170" y1="8" x2="170" y2="136" stroke="rgba(255,255,255,0.08)" strokeDasharray="3" />
                  <line x1="320" y1="8" x2="320" y2="136" stroke="rgba(255,255,255,0.08)" strokeDasharray="3" />
                  <line x1="390" y1="8" x2="390" y2="136" stroke="rgba(255,255,255,0.08)" strokeDasharray="3" />
                  <line x1="450" y1="8" x2="450" y2="136" stroke="rgba(255,255,255,0.08)" strokeDasharray="3" />

                  {/* 时间阶段横轴文本描述 */}
                  <text x="60" y="146" fill="var(--muted)" fontSize="9.5" textAnchor="middle" fontWeight="bold">火警报警 (T=0)</text>
                  <text x="145" y="146" fill="var(--muted)" fontSize="9.5" textAnchor="middle" fontWeight="bold">人工确认</text>
                  <text x="245" y="146" fill="var(--muted)" fontSize="9.5" textAnchor="middle" fontWeight="bold">25s倒计时延时</text>
                  <text x="355" y="146" fill="var(--muted)" fontSize="9.5" textAnchor="middle" fontWeight="bold">开分配阀</text>
                  <text x="420" y="146" fill="var(--muted)" fontSize="9.5" textAnchor="middle" fontWeight="bold">开声光警报</text>
                  <text x="483" y="146" fill="var(--muted)" fontSize="9.5" textAnchor="middle" fontWeight="bold">喷洒灭火</text>

                  {/* 行 1: 声警报 */}
                  <text x="15" y="24" fill="#fff" fontSize="10" fontWeight="bold">1# 声警报音响</text>
                  <rect x="120" y="15" width="396" height="10" rx="3" fill={soundAlarmActive ? "rgba(255, 77, 94, 0.25)" : "rgba(255,255,255,0.03)"} stroke={soundAlarmActive ? "var(--red)" : "rgba(255,255,255,0.05)"} strokeWidth="0.8" />
                  {soundAlarmActive && (
                    <rect x="120" y="15" width="396" height="10" rx="3" fill="var(--red)" opacity="0.6" style={{ animation: "flashBeacon 0.8s infinite alternate" }} />
                  )}

                  {/* 行 2: 人工确认 */}
                  <text x="15" y="48" fill="#fff" fontSize="10" fontWeight="bold">2# 人工确认键</text>
                  <rect x="120" y="39" width="50" height="10" rx="3" fill={status === "confirming" ? "rgba(255, 186, 82, 0.25)" : status !== "safe" && status !== "alarmed" && status !== "aborted" ? "rgba(55, 242, 193, 0.25)" : "rgba(255,255,255,0.03)"} stroke={status === "confirming" ? "var(--amber)" : status !== "safe" && status !== "alarmed" && status !== "aborted" ? "var(--green)" : "rgba(255,255,255,0.05)"} strokeWidth="0.8" />
                  {status === "confirming" && (
                    <rect x="120" y="39" width="50" height="10" rx="3" fill="var(--amber)" opacity="0.6" style={{ animation: "flashBeacon 0.5s infinite alternate" }} />
                  )}

                  {/* 行 3: 气体分配阀 */}
                  <text x="15" y="72" fill="#fff" fontSize="10" fontWeight="bold">3# 气体分配阀</text>
                  <rect x="320" y="63" width="196" height="10" rx="3" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />
                  {(status === "valves" || status === "pump" || status === "spraying") && (
                    <rect
                      x="320"
                      y="63"
                      width={status === "valves" ? `${(valveOpeningProgress / 100) * 70}` : 196}
                      height="10"
                      rx="3"
                      fill="var(--cyan)"
                      stroke="var(--cyan)"
                      strokeWidth="0.8"
                      style={{ filter: "drop-shadow(0 0 3px var(--cyan))", transition: "width 0.15s linear" }}
                    />
                  )}

                  {/* 行 4: 声光报警器 */}
                  <text x="15" y="96" fill="#fff" fontSize="10" fontWeight="bold">4# 声光报警器</text>
                  <rect x="390" y="87" width="126" height="10" rx="3" fill={sirenActive ? "rgba(255, 77, 94, 0.25)" : "rgba(255,255,255,0.03)"} stroke={sirenActive ? "var(--red)" : "rgba(255,255,255,0.05)"} strokeWidth="0.8" />
                  {sirenActive && (
                    <rect x="390" y="87" width="126" height="10" rx="3" fill="var(--red)" opacity="0.6" style={{ animation: "flashBeacon 0.4s infinite alternate" }} />
                  )}

                  {/* 行 5: 气瓶药剂释放 */}
                  <text x="15" y="120" fill="#fff" fontSize="10" fontWeight="bold">5# 释放气体灭火</text>
                  <rect x="450" y="111" width="66" height="10" rx="3" fill={status === "spraying" ? "rgba(255, 77, 94, 0.3)" : "rgba(255,255,255,0.03)"} stroke={status === "spraying" ? "var(--red)" : "rgba(255,255,255,0.05)"} strokeWidth="0.8" />
                  {status === "spraying" && (
                    <rect x="450" y="111" width="66" height="10" rx="3" fill="var(--red)" opacity="0.7" style={{ animation: "flashBeacon 0.3s infinite alternate" }} />
                  )}

                  {/* 扫描的红光时序游标线 */}
                  {status !== "safe" && status !== "aborted" && (
                    <g>
                      <line
                        x1={
                          status === "alarmed" ? 120
                            : status === "confirming" ? 145
                              : status === "counting" ? 170 + ((25 - countdown) / 25) * 150
                                : status === "valves" ? 320 + (valveOpeningProgress / 100) * 70
                                  : status === "pump" ? 420
                                    : 483
                        }
                        y1="6"
                        x2={
                          status === "alarmed" ? 120
                            : status === "confirming" ? 145
                              : status === "counting" ? 170 + ((25 - countdown) / 25) * 150
                                : status === "valves" ? 320 + (valveOpeningProgress / 100) * 70
                                  : status === "pump" ? 420
                                    : 483
                        }
                        y2="138"
                        stroke="var(--red)"
                        strokeWidth="1.8"
                        style={{ transition: (status === "counting" || status === "valves") ? "all 0.15s linear" : "all 0.5s ease-out" }}
                      />
                      <circle
                        cx={
                          status === "alarmed" ? 120
                            : status === "confirming" ? 145
                              : status === "counting" ? 170 + ((25 - countdown) / 25) * 150
                                : status === "valves" ? 320 + (valveOpeningProgress / 100) * 70
                                  : status === "pump" ? 420
                                    : 483
                        }
                        cy="6"
                        r="3.5"
                        fill="var(--red)"
                        style={{ transition: (status === "counting" || status === "valves") ? "all 0.15s linear" : "all 0.5s ease-out" }}
                      />
                      <circle
                        cx={
                          status === "alarmed" ? 120
                            : status === "confirming" ? 145
                              : status === "counting" ? 170 + ((25 - countdown) / 25) * 150
                                : status === "valves" ? 320 + (valveOpeningProgress / 100) * 70
                                  : status === "pump" ? 420
                                    : 483
                        }
                        cy="138"
                        r="3.5"
                        fill="var(--red)"
                        style={{ transition: (status === "counting" || status === "valves") ? "all 0.15s linear" : "all 0.5s ease-out" }}
                      />
                    </g>
                  )}
                </svg>
              </div>
            ) : (
              /* 细水雾流程状态机 (高压细水雾喷淋工艺流程控制图) */
              <div style={{ marginTop: "12px", position: "relative", width: "100%", overflowX: "auto" }}>
                <svg width="100%" height="152" viewBox="0 0 540 152" style={{ overflow: "visible", minWidth: "500px" }}>
                  <defs>
                    <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3498db" />
                      <stop offset="100%" stopColor="#2980b9" />
                    </linearGradient>
                    <linearGradient id="flowPipeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#4f5d73" />
                      <stop offset="100%" stopColor="#2c3e50" />
                    </linearGradient>
                  </defs>

                  {/* 时序背景背板 */}
                  <rect x="0" y="0" width="536" height="144" fill="rgba(10, 24, 44, 0.3)" rx="8" stroke="rgba(77, 231, 255, 0.1)" strokeWidth="1" />

                  {/* 1. 储水箱 (Water Tank) */}
                  <g transform="translate(15, 25)">
                    {/* 钢罐身 */}
                    <rect x="0" y="0" width="46" height="56" fill="rgba(44, 62, 80, 0.8)" stroke="#7f8c8d" strokeWidth="1.2" rx="3" />
                    {/* 内部水面 */}
                    <rect x="3" y="16" width="40" height="37" fill="url(#waterGrad)" opacity="0.7" rx="1.5" />
                    {/* 水波浪微粒动效 */}
                    <rect x="3" y="16" width="40" height="2" fill="#fff" opacity="0.3" style={{ animation: "flashBeacon 1s infinite alternate" }} />
                    <text x="23" y="48" fill="#fff" fontSize="8.5" textAnchor="middle" fontWeight="bold">储水箱</text>
                  </g>

                  {/* 2. 高压稳压泵组 (Mist Pump) */}
                  <g transform="translate(145, 25)">
                    {/* 电机圆柱 */}
                    <rect x="0" y="14" width="44" height="28" fill="url(#metalRack)" rx="3" stroke="#555" />
                    <rect x="6" y="11" width="32" height="3" fill="#333" />
                    {/* 水泵扇叶电机轮 */}
                    <circle cx="22" cy="28" r="11" fill="#1a202c" stroke="#666" strokeWidth="1" />
                    {/* 风扇旋转叶 */}
                    <g transform={`translate(22, 28) rotate(${pumpActive ? 360 : 0})`} style={{ animation: pumpActive ? "spinPropeller 0.2s linear infinite" : "none", transformOrigin: "0px 0px" } as any}>
                      <line x1="0" y1="-8" x2="0" y2="8" stroke="var(--cyan)" strokeWidth="2.2" strokeLinecap="round" />
                      <line x1="-8" y1="0" x2="8" y2="0" stroke="var(--cyan)" strokeWidth="2.2" strokeLinecap="round" />
                    </g>
                    <text x="22" y="58" fill="var(--muted)" fontSize="8.5" textAnchor="middle" fontWeight="bold">高压水泵</text>
                  </g>

                  {/* 3. 阀门组 (Selector Valve) */}
                  <g transform="translate(290, 25)">
                    {/* 阀门左右两个三角 */}
                    <polygon points="4,18 20,28 4,38" fill="#7f8c8d" stroke="#555" strokeWidth="0.8" />
                    <polygon points="36,18 20,28 36,38" fill="#7f8c8d" stroke="#555" strokeWidth="0.8" />
                    {/* 阀芯圆 */}
                    <circle cx="20" cy="28" r="9" fill="url(#metalRack)" stroke="#555" strokeWidth="0.8" />
                    <circle cx="20" cy="28" r="6" fill="#1a202c" />
                    {/* 电磁驱动头 */}
                    <rect x="15" y="4" width="10" height="9" fill="url(#brassGrad)" rx="1" />
                    {/* 旋转手轮 */}
                    <g transform={`translate(20, 28) rotate(${zoneValveOpen ? 90 : 0})`} style={{ transition: "transform 0.5s ease" }}>
                      <line x1="0" y1="-7" x2="0" y2="7" stroke={zoneValveOpen ? "var(--green)" : "var(--red)"} strokeWidth="2.5" strokeLinecap="round" />
                      <circle cx="0" cy="0" r="1.5" fill="#fff" />
                    </g>
                    <text x="20" y="58" fill="var(--muted)" fontSize="8.5" textAnchor="middle" fontWeight="bold">分配阀组</text>
                  </g>

                  {/* 4. 水雾喷嘴 (Nozzle) */}
                  <g transform="translate(440, 25)">
                    {/* 喷头漏斗身 */}
                    <polygon points="8,10 32,10 26,24 14,24" fill="url(#metalRack)" stroke="#555" strokeWidth="0.8" />
                    <rect x="17" y="24" width="6" height="8" fill="url(#metalRack)" />
                    {/* 红色感温泡 */}
                    {!sprayingActive && (
                      <line x1="20" y1="26" x2="20" y2="34" stroke="#ff2233" strokeWidth="2" strokeLinecap="round" />
                    )}
                    {/* 喷发的水雾树 */}
                    {sprayingActive && (
                      <path d="M 20 30 L 0 54 L 40 54 Z" fill="rgba(180, 240, 255, 0.4)" />
                    )}
                    <text x="20" y="58" fill="var(--muted)" fontSize="8.5" textAnchor="middle" fontWeight="bold">水雾喷嘴</text>
                  </g>

                  {/* 5. 核心管道网连接 */}
                  {/* 水箱 -> 水泵 */}
                  <line x1="61" y1="53" x2="145" y2="53" stroke="#4a5568" strokeWidth="5.5" strokeLinecap="round" />
                  {(status === "valves" || status === "pump" || status === "spraying") && (
                    <line x1="61" y1="53" x2="145" y2="53" stroke="var(--cyan)" strokeWidth="3" strokeDasharray="6,4" style={{ animation: "flowMove 1.5s infinite linear" }} />
                  )}

                  {/* 水泵 -> 阀门 */}
                  <line x1="189" y1="53" x2="294" y2="53" stroke="#4a5568" strokeWidth="5.5" strokeLinecap="round" />
                  {(status === "pump" || status === "spraying") && (
                    <line x1="189" y1="53" x2="294" y2="53" stroke="var(--cyan)" strokeWidth="3" strokeDasharray="6,4" style={{ animation: "flowMove 1.5s infinite linear" }} />
                  )}

                  {/* 阀门 -> 喷嘴 */}
                  <line x1="326" y1="53" x2="444" y2="53" stroke="#4a5568" strokeWidth="5.5" strokeLinecap="round" />
                  {sprayingActive && (
                    <line x1="326" y1="53" x2="444" y2="53" stroke="var(--cyan)" strokeWidth="3" strokeDasharray="6,4" style={{ animation: "flowMove 1.5s infinite linear" }} />
                  )}

                  {/* 流程文字指示条 */}
                  <rect x="40" y="102" width="460" height="24" fill="rgba(0,0,0,0.4)" rx="5" stroke="rgba(255,255,255,0.03)" />
                  <text x="270" y="118" fill={sprayingActive ? "var(--red)" : status !== "safe" && status !== "aborted" ? "var(--cyan)" : "var(--muted)"} fontSize="9.5" textAnchor="middle" fontWeight="bold">
                    {status === "safe" ? "🟢 细水雾系统就绪：等待火警联锁驱动..."
                      : status === "alarmed" ? "🚨 火警报警触发：声警报已拉响，等待操作员点击确认..."
                        : status === "confirming" ? "⚠️ 火警确认挂起：请操作员核实后点击确认开启管网阀门..."
                          : status === "valves" ? `⏳ 联动动作一：保护区电磁分配阀正在驱动开启中... [阀开度: ${valveOpeningProgress}%]`
                            : status === "pump" ? "⏳ 联动动作二：分配阀门开启完毕，联锁驱动高压柱塞泵启动加压..."
                              : status === "spraying" ? "🔥 联动释放中：高压水雾喷洒释放，全力扑灭保护区火灾！"
                                : "🛑 联动系统中止：防消管网关闭锁死。"}
                  </text>
                </svg>
              </div>
            )}
          </div>

          {/* 硬件组态显示网格 */}
          <div className="hardware-grid">
            
            {/* 1. 分配阀 (Selector Valve) - 两个手段均使用，但1301有倒计时开阀动画 */}
            <div className="hardware-card">
              <div className="hardware-title">气体分配阀组 (Selector Valve)</div>
              <div className="h-visual">
                <svg width="100" height="90" viewBox="0 0 100 90" style={{ overflow: "visible" }}>
                  <defs>
                    <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#4e5d6c" />
                      <stop offset="50%" stopColor="#8ba4bd" />
                      <stop offset="100%" stopColor="#2d3741" />
                    </linearGradient>
                    <linearGradient id="actuatorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ff7f11" />
                      <stop offset="50%" stopColor="#ff9f43" />
                      <stop offset="100%" stopColor="#d35400" />
                    </linearGradient>
                  </defs>

                  {/* 管网高压流通微弱发光 */}
                  <rect x="5" y="38" width="90" height="16" fill="rgba(0, 0, 0, 0.4)" rx="2" />
                  {valveOpeningProgress > 0 && (
                    <rect x="5" y="40" width={`${(valveOpeningProgress / 100) * 90}`} height="12" fill="rgba(77, 231, 255, 0.25)" rx="1" style={{ animation: "pulseGlow 1s infinite alternate" }} />
                  )}

                  {/* 左右管道接头 */}
                  <rect x="5" y="40" width="28" height="12" fill="url(#pipeGrad)" rx="1" />
                  <rect x="67" y="40" width="28" height="12" fill="url(#pipeGrad)" rx="1" />

                  {/* 法兰盘组件 */}
                  <rect x="27" y="30" width="7" height="32" fill="#7f8c8d" rx="1.5" stroke="#34495e" strokeWidth="0.8" />
                  <rect x="66" y="30" width="7" height="32" fill="#7f8c8d" rx="1.5" stroke="#34495e" strokeWidth="0.8" />
                  <circle cx="30.5" cy="35" r="1.8" fill="#bdc3c7" />
                  <circle cx="30.5" cy="57" r="1.8" fill="#bdc3c7" />
                  <circle cx="69.5" cy="35" r="1.8" fill="#bdc3c7" />
                  <circle cx="69.5" cy="57" r="1.8" fill="#bdc3c7" />

                  {/* 阀体球阀主体 */}
                  <circle cx="50" cy="46" r="19" fill="url(#pipeGrad)" stroke="#7f8c8d" strokeWidth="1.5" />
                  <circle cx="50" cy="46" r="12" fill="#2c3e50" stroke="rgba(255,255,255,0.1)" />

                  {/* 电子阀头执行装置 */}
                  <rect x="38" y="8" width="24" height="20" fill="url(#actuatorGrad)" stroke="#d35400" strokeWidth="1.5" rx="2.5" />

                  {/* 角度旋转机械指针 - 倒计时开始后逐渐从0旋转到90度 */}
                  <g transform={`translate(50, 18) rotate(${(valveOpeningProgress / 100) * 90})`} style={{ transition: "transform 0.4s ease-out" }}>
                    <line x1="0" y1="-8" x2="0" y2="8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="0" cy="0" r="2.5" fill="#e74c3c" />
                  </g>
                </svg>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "11px", color: "var(--muted)" }}>
                <span>阀门开度:</span>
                <strong style={{ color: selectorValveOpen ? "var(--green)" : valveOpeningProgress > 0 ? "var(--amber)" : "#fff" }}>
                  {valveOpeningProgress}% {selectorValveOpen ? "已开通" : valveOpeningProgress > 0 ? "开启中" : "闭锁常闭"}
                </strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", fontSize: "11px" }}>
                <div className={`blinker ${selectorValveOpen ? "green-flash" : valveOpeningProgress > 0 ? "amber-flash" : ""}`} />
                <span>物理反馈：{selectorValveOpen ? "阀门开启就绪" : valveOpeningProgress > 0 ? "马达旋转中..." : "常闭锁闭"}</span>
              </div>
            </div>

            {/* 2. 声光警报器 (Siren/Alarm) - 两个手段均可开启，倒计时/释放时强闪烁 */}
            <div className="hardware-card">
              <div className="hardware-title">防爆声光报警器 (Siren)</div>
              <div className="h-visual">
                <svg width="100" height="90" viewBox="0 0 100 90" style={{ overflow: "visible" }}>
                  <defs>
                    <radialGradient id="sirenGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgba(255, 77, 94, 0.85)" />
                      <stop offset="50%" stopColor="rgba(255, 77, 94, 0.35)" />
                      <stop offset="100%" stopColor="rgba(255, 77, 94, 0)" />
                    </radialGradient>
                    <linearGradient id="metalBody" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#7f8c8d" />
                      <stop offset="100%" stopColor="#2c3e50" />
                    </linearGradient>
                  </defs>

                  {/* 旋转警示灯辉光 */}
                  {sirenActive && (
                    <circle cx="50" cy="46" r="34" fill="url(#sirenGlow)" style={{ animation: "flashBeacon 0.4s infinite alternate" }} />
                  )}

                  {/* 防爆喇叭开口 */}
                  <path d="M 16 52 L 6 47 L 6 57 Z" fill="#95a5a6" />
                  <path d="M 84 52 L 94 47 L 94 57 Z" fill="#95a5a6" />

                  {/* 声光警铃铸铁底座 */}
                  <rect x="25" y="52" width="50" height="22" fill="url(#metalBody)" rx="3" stroke="#34495e" />
                  <rect x="32" y="60" width="36" height="5" fill="#111" rx="1" />

                  {/* 防爆红色防爆玻璃罩 */}
                  <path d="M 32 52 C 32 24, 68 24, 68 52 Z" fill={sirenActive ? "rgba(255, 77, 94, 0.35)" : "rgba(255, 255, 255, 0.08)"} stroke={sirenActive ? "#ff4d5e" : "#bdc3c7"} strokeWidth="1.5" />

                  {/* 报警灯丝发光原件 */}
                  <circle cx="50" cy="44" r="5" fill={sirenActive ? "#ff2233" : "#7f8c8d"} />
                  <circle cx="43" cy="47" r="3" fill={sirenActive ? "#ffb703" : "#7f8c8d"} />
                  <circle cx="57" cy="47" r="3" fill={sirenActive ? "#ffb703" : "#7f8c8d"} />

                  {/* 扫射炫目警用大灯束光 */}
                  {sirenActive && (
                    <g style={{ animation: "rotatingLight 1.2s linear infinite", transformOrigin: "50px 44px" }}>
                      <polygon points="50,44 15,-10 28,-18" fill="rgba(255, 77, 94, 0.3)" />
                      <polygon points="50,44 85,98 72,108" fill="rgba(255, 77, 94, 0.3)" />
                    </g>
                  )}
                </svg>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "11px", color: "var(--muted)" }}>
                <span>报警强度:</span>
                <strong style={{ color: sirenActive ? "var(--red)" : "#fff" }}>
                  {sirenActive ? "110 dB 强闪烁" : "0 dB 监视"}
                </strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", fontSize: "11px" }}>
                <div className={`blinker ${sirenActive ? "red-flash" : ""}`} />
                <span>警报状态：{sirenActive ? "爆闪鸣叫中" : "常态监视"}</span>
              </div>
            </div>

            {/* 3. 1301 灭火剂钢瓶组 - 气体手段专属，细水雾时旁路灰化 */}
            <div className={`hardware-card ${method !== "1301" ? "bypassed" : ""}`}>
              <div className="hardware-title">1301 电磁释放钢瓶 (Agent Tank)</div>
              <div className="h-visual" style={{ overflow: "visible" }}>
                {/* 释放时的烟雾粒子喷发效果 */}
                {sprayingActive && method === "1301" && (
                  <>
                    <div className="gas-cloud" style={{ left: "45%", "--drift": "-10px" } as any} />
                    <div className="gas-cloud" style={{ left: "50%", "--drift": "15px", animationDelay: "0.2s" } as any} />
                    <div className="gas-cloud" style={{ left: "55%", "--drift": "-5px", animationDelay: "0.4s" } as any} />
                    <div className="gas-cloud" style={{ left: "40%", "--drift": "25px", animationDelay: "0.6s" } as any} />
                  </>
                )}

                <svg width="100" height="120" viewBox="0 0 100 120" style={{ overflow: "visible" }}>
                  <defs>
                    <linearGradient id="cylinderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#962d22" />
                      <stop offset="40%" stopColor="#e74c3c" />
                      <stop offset="70%" stopColor="#ff7675" />
                      <stop offset="100%" stopColor="#962d22" />
                    </linearGradient>
                    <linearGradient id="brassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#cca300" />
                      <stop offset="50%" stopColor="#f1c40f" />
                      <stop offset="100%" stopColor="#9e7e00" />
                    </linearGradient>
                  </defs>

                  {/* 红色防震钢瓶罐体 */}
                  <rect x="36" y="26" width="28" height="78" fill="url(#cylinderGrad)" rx="6" stroke="#5f1d15" strokeWidth="0.8" />
                  <path d="M 36 34 C 36 22, 64 22, 64 34 Z" fill="url(#cylinderGrad)" />

                  {/* 抱箍固定条 */}
                  <rect x="33" y="48" width="34" height="5" fill="#2c3e50" rx="1.5" />
                  <rect x="33" y="78" width="34" height="5" fill="#2c3e50" rx="1.5" />

                  {/* 黄铜释放电磁阀头 */}
                  <rect x="46" y="12" width="8" height="14" fill="url(#brassGrad)" rx="1.2" />
                  <circle cx="50" cy="14" r="5" fill="url(#brassGrad)" />
                  <rect x="41" y="7" width="18" height="5" fill="url(#brassGrad)" rx="1" />

                  {/* 高压弯曲软金属输气管 */}
                  <path d="M 54 12 Q 74 12, 74 44 L 74 65" fill="none" stroke="#2b3a4a" strokeWidth="2.5" strokeLinecap="round" />

                  {/* 精密压力圆表 */}
                  <circle cx="50" cy="44" r="12" fill="#ffffff" stroke="#333" strokeWidth="1.5" />
                  {/* 红绿表盘分界区 */}
                  <path d="M 41 44 A 9 9 0 0 1 50 35" fill="none" stroke="#ff4d5e" strokeWidth="2.2" />
                  <path d="M 50 35 A 9 9 0 0 1 59 44" fill="none" stroke="var(--green)" strokeWidth="2.2" />

                  {/* 动态气压表盘指针：从 2.0MPa 降到 0.0MPa */}
                  <g transform={`translate(50, 44) rotate(${Math.min(90, Math.max(-90, (cylinderPressure / 2.0) * 180 - 90))})`} style={{ transition: "transform 0.4s ease" }}>
                    <line x1="0" y1="0" x2="9" y2="0" stroke="#c0392b" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="0" cy="0" r="1.5" fill="#333" />
                  </g>
                </svg>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "11px", color: "var(--muted)" }}>
                <span>瓶组储压:</span>
                <strong style={{ color: cylinderPressure < 0.4 ? "var(--red)" : "var(--green)" }}>
                  {cylinderPressure.toFixed(1)} MPa ({cylinderPressure > 1.8 ? "满瓶" : cylinderPressure < 0.1 ? "空瓶" : "释放中"})
                </strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", fontSize: "11px" }}>
                <div className={`blinker ${sprayingActive ? "red-flash" : cylinderPressure > 1.5 ? "green-flash" : ""}`} />
                <span>药剂状态：{cylinderPressure < 0.1 ? "药剂已排空" : "重压备命"}</span>
              </div>
            </div>

            {/* 4. 泵组启动器 (Mist Pump) - 细水雾手段专属，气体手段时旁路灰化 */}
            <div className={`hardware-card ${method !== "mist" ? "bypassed" : ""}`}>
              <div className="hardware-title">高压雾化泵组 (Mist Pump)</div>
              <div className="h-visual">
                <svg width="120" height="90" viewBox="0 0 120 90" style={{ overflow: "visible" }}>
                  <defs>
                    <linearGradient id="motorBlue" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#2c3e50" />
                      <stop offset="50%" stopColor="#3498db" />
                      <stop offset="100%" stopColor="#1f2d3d" />
                    </linearGradient>
                    <linearGradient id="pumpSteel" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#7f8c8d" />
                      <stop offset="50%" stopColor="#bdc3c7" />
                      <stop offset="100%" stopColor="#95a5a6" />
                    </linearGradient>
                  </defs>

                  {/* 泵体工作轻微震颤特效 */}
                  <g style={{
                    transform: pumpActive ? "translate(0.6px, 0.6px)" : "none",
                    transition: "transform 0.05s linear"
                  }}>
                    {/* 散热槽电机蓝 */}
                    <rect x="15" y="24" width="46" height="38" fill="url(#motorBlue)" rx="3" stroke="#2980b9" strokeWidth="0.8" />
                    <rect x="21" y="20" width="3" height="46" fill="#1f2d3d" />
                    <rect x="29" y="20" width="3" height="46" fill="#1f2d3d" />
                    <rect x="37" y="20" width="3" height="46" fill="#1f2d3d" />
                    <rect x="45" y="20" width="3" height="46" fill="#1f2d3d" />
                    <rect x="53" y="20" width="3" height="46" fill="#1f2d3d" />

                    {/* 电机电源盒 */}
                    <rect x="30" y="14" width="16" height="10" fill="#2c3e50" rx="1.5" stroke="#34495e" />

                    {/* 动力传动轴承 */}
                    <rect x="61" y="33" width="12" height="20" fill="#7f8c8d" rx="1" />

                    {/* 不锈钢高压泵阀体 */}
                    <rect x="73" y="28" width="32" height="30" fill="url(#pumpSteel)" rx="2" stroke="#7f8c8d" />
                    <circle cx="80" cy="35" r="2.2" fill="#34495e" />
                    <circle cx="80" cy="51" r="2.2" fill="#34495e" />
                    <circle cx="98" cy="35" r="2.2" fill="#34495e" />
                    <circle cx="98" cy="51" r="2.2" fill="#34495e" />

                    {/* 补水平衡稳压罐 */}
                    <path d="M 81 28 C 81 12, 97 12, 97 28 Z" fill="#f1c40f" stroke="#d68910" strokeWidth="1.2" />

                    {/* 电机散热风扇 */}
                    <rect x="5" y="31" width="10" height="24" fill="#7f8c8d" rx="1" />
                    <circle cx="10" cy="43" r="3.5" fill="#2c3e50" />
                    {pumpActive && (
                      <line x1="10" y1="31" x2="10" y2="55" stroke="#f1c40f" strokeWidth="1.5" style={{ animation: "spinPropeller 0.1s linear infinite", transformOrigin: "10px 43px" }} />
                    )}
                  </g>
                </svg>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "11px", color: "var(--muted)" }}>
                <span>负载状态:</span>
                <strong style={{ color: pumpActive ? "var(--green)" : "#fff" }}>
                  {pumpActive ? "100% 动力泵运行" : "0% 待命停机"}
                </strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", fontSize: "11px" }}>
                <div className={`blinker ${pumpActive ? "green-flash" : ""}`} />
                <span>运行指示：{pumpActive ? "高压柱塞泵输出中" : "常态待机"}</span>
              </div>
            </div>

            {/* 5. 细水雾喷头 (Water Mist Nozzle) - 细水雾专属，气体时旁路灰化 */}
            <div className={`hardware-card ${method !== "mist" ? "bypassed" : ""}`}>
              <div className="hardware-title">高压细水雾喷头 (Nozzle)</div>
              <div className="h-visual" style={{ overflow: "hidden" }}>
                <svg width="100" height="100" viewBox="0 0 100 100" style={{ overflow: "visible" }}>
                  <defs>
                    <linearGradient id="nozzleSteel" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#bdc3c7" />
                      <stop offset="50%" stopColor="#ecf0f1" />
                      <stop offset="100%" stopColor="#95a5a6" />
                    </linearGradient>
                    <radialGradient id="mistGrad" cx="50%" cy="0%" r="100%">
                      <stop offset="0%" stopColor="rgba(180, 240, 255, 0.8)" />
                      <stop offset="45%" stopColor="rgba(200, 245, 255, 0.45)" />
                      <stop offset="100%" stopColor="rgba(220, 250, 255, 0)" />
                    </radialGradient>
                  </defs>

                  {/* 镀铬金属喷头身 */}
                  <polygon points="36,6 64,6 70,18 61,30 39,30 30,18" fill="url(#nozzleSteel)" stroke="#95a5a6" strokeWidth="0.8" />
                  <rect x="42" y="30" width="16" height="12" fill="url(#nozzleSteel)" />

                  {/* 防撞保护支架 */}
                  <path d="M 43 42 L 34 62 Q 50 72, 66 62 L 57 42" fill="none" stroke="url(#nozzleSteel)" strokeWidth="3" strokeLinecap="round" />
                  <rect x="45" y="62" width="10" height="5" fill="url(#nozzleSteel)" rx="0.8" />

                  {/* 红色感温玻璃泡 (喷水后碎裂消失) */}
                  {!sprayingActive && (
                    <rect x="48.5" y="42" width="3" height="20" fill="#ff2233" rx="1.5" style={{ animation: "blinkActive 1s infinite alternate" }} />
                  )}

                  {/* 细水雾微粒喷射云效果 */}
                  {sprayingActive && method === "mist" && (
                    <g opacity="0.85">
                      <path d="M 50 64 L 15 100 L 85 100 Z" fill="url(#mistGrad)" />
                      <path d="M 38 58 L 5 95 L 45 95 Z" fill="url(#mistGrad)" />
                      <path d="M 62 58 L 55 95 L 95 95 Z" fill="url(#mistGrad)" />
                    </g>
                  )}
                </svg>

                {/* 漂漂雾气小微粒动画 */}
                {sprayingActive && method === "mist" && (
                  <>
                    {Array.from({ length: 24 }).map((_, idx) => (
                      <div key={idx} className="mist-particle" style={{
                        left: `${44 + (idx % 6) * 2}%`,
                        animationDelay: `${idx * 0.03}s`,
                        animationDuration: `${0.4 + (idx % 3) * 0.12}s`, // 变初速高压喷射
                        // @ts-ignore
                        "--drift": `${(idx % 2 === 0 ? -22 : 22) * ((idx % 3) + 1) / 3 + (Math.random() * 8 - 4)}px`
                      }} />
                    ))}
                  </>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "11px", color: "var(--muted)" }}>
                <span>喷淋流速:</span>
                <strong style={{ color: sprayingActive ? "var(--red)" : "#fff" }}>
                  {sprayingActive ? "120 L/min 高压雾化" : "0 L/min 静态"}
                </strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", fontSize: "11px" }}>
                <div className={`blinker ${sprayingActive ? "red-flash" : ""}`} />
              </div>
            </div>

          </div>
        </div>
      </div>
      </>
      )}

      {/* 灭火剂储存站监视子页面 */}
      {activeSubTab === "stations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "fadeIn 0.3s ease-out" }}>
          {/* 储存站头部控制与选择 */}
          <div style={{
            background: "rgba(10, 24, 44, 0.65)",
            border: "1px solid var(--line)",
            borderRadius: "14px",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            backdropFilter: "blur(12px)"
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "17px", color: "#fff", fontWeight: "bold" }}>灭火剂储存瓶组站监视</h2>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>监控中心 A/B/C 三个高压瓶组物理分配站</span>
            </div>

            {/* 灭火站选择 */}
            <div style={{ display: "flex", gap: "8px", background: "rgba(0,0,0,0.4)", padding: "3px", borderRadius: "8px", border: "1px solid var(--line)" }}>
              {(["A", "B", "C"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStation(st)}
                  style={{
                    background: selectedStation === st ? "var(--cyan)" : "transparent",
                    color: selectedStation === st ? "#000" : "var(--muted)",
                    border: 0,
                    borderRadius: "6px",
                    fontSize: "11px",
                    padding: "5px 14px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    transition: "all 0.15s"
                  }}
                >
                  灭火站 {st} {st === "A" ? "(1301)" : st === "B" ? "(细水雾)" : "(备用)"}
                </button>
              ))}
            </div>
          </div>

          {/* 灭火站钢瓶展示面板 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr",
            gap: "20px"
          }}>
            {/* 左侧参数说明 */}
            <div style={{
              background: "rgba(14, 28, 48, 0.8)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}>
              <h3 style={{ margin: 0, fontSize: "14px", color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>
                灭火站 {selectedStation} 组态参数
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>保护区域:</span>
                  <span style={{ color: "#fff", fontWeight: "bold" }}>
                    {selectedStation === "A" ? "B1 配电间" : selectedStation === "B" ? "F3 智能开发办公区" : "F2 多功能会议大厅"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>配置介质:</span>
                  <span style={{ color: "var(--cyan)", fontWeight: "bold" }}>
                    {selectedStation === "B" ? "高压细水雾启动瓶组" : "1301 氟代烷气体"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>配置数量:</span>
                  <span style={{ color: "#fff" }}>7 储气钢瓶</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>储量规格:</span>
                  <span style={{ color: "#fff" }}>1x ZS40 (40L) + 6x ZS85 (85L)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>运行状态:</span>
                  {(() => {
                    const press = selectedStation === "A" ? pressuresA : selectedStation === "B" ? pressuresB : pressuresC;
                    const isAllZero = press.every((p) => p < 0.1);
                    const isSpraying = status === "spraying" && (
                      (method === "1301" && (selectedStation === "A" || selectedStation === "C")) || 
                      (method === "mist" && selectedStation === "B")
                    );
                    if (isSpraying) return <span style={{ color: "var(--red)", fontWeight: "bold", animation: "flash 0.5s infinite alternate" }}>🚨 正在喷洒释放</span>;
                    if (isAllZero) return <span style={{ color: "var(--amber)", fontWeight: "bold" }}>⚠️ 药剂已释空 (待充装)</span>;
                    return <span style={{ color: "var(--green)", fontWeight: "bold" }}>🟢 监测正常·备命</span>;
                  })()}
                </div>
              </div>

              {/* 手动控制操作 */}
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <button
                  onClick={() => {
                    // 手动模拟释放该站
                    if (selectedStation === "A") {
                      setPressuresA(Array(7).fill(0));
                    } else if (selectedStation === "B") {
                      setPressuresB(Array(7).fill(0));
                    } else {
                      setPressuresC(Array(7).fill(0));
                    }
                  }}
                  style={{
                    background: "rgba(255, 77, 94, 0.12)",
                    border: "1px solid rgba(255, 77, 94, 0.3)",
                    color: "#ff4d5e",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "11.5px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  仿真模拟：手动就地紧急释放
                </button>
                <button
                  onClick={() => {
                    // 充气复位
                    if (selectedStation === "A") {
                      setPressuresA([2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0]);
                    } else if (selectedStation === "B") {
                      setPressuresB([15.0, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2]);
                    } else {
                      setPressuresC([2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0]);
                    }
                  }}
                  style={{
                    background: "rgba(55, 242, 193, 0.12)",
                    border: "1px solid rgba(55, 242, 193, 0.3)",
                    color: "var(--green)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "11.5px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  一键安全气相重装复位
                </button>
              </div>
            </div>

            {/* 右侧直观钢瓶 SVG */}
            <div style={{
              background: "rgba(10, 24, 44, 0.65)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "260px"
            }}>
              {/* SVG cylinder visualization block */}
              {(() => {
                const press = selectedStation === "A" ? pressuresA : selectedStation === "B" ? pressuresB : pressuresC;
                const isSpraying = status === "spraying" && (
                  (method === "1301" && (selectedStation === "A" || selectedStation === "C")) || 
                  (method === "mist" && selectedStation === "B")
                );

                return (
                  <div style={{ position: "relative", width: "100%" }}>
                    {/* manifold flow smoke particles when discharging */}
                    {isSpraying && (
                      <>
                        <div className="gas-cloud" style={{ left: "20%", top: "-10px", "--drift": "-15px" } as any} />
                        <div className="gas-cloud" style={{ left: "40%", top: "-10px", "--drift": "10px", animationDelay: "0.2s" } as any} />
                        <div className="gas-cloud" style={{ left: "60%", top: "-10px", "--drift": "-10px", animationDelay: "0.4s" } as any} />
                        <div className="gas-cloud" style={{ left: "80%", top: "-10px", "--drift": "15px", animationDelay: "0.6s" } as any} />
                      </>
                    )}

                    <svg width="100%" height="240" viewBox="0 0 540 240" style={{ overflow: "visible" }}>
                      <defs>
                        <linearGradient id="metalRack" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#4f5d73" />
                          <stop offset="100%" stopColor="#2c3e50" />
                        </linearGradient>
                        <linearGradient id="cylinderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#962d22" />
                          <stop offset="40%" stopColor="#e74c3c" />
                          <stop offset="70%" stopColor="#ff7675" />
                          <stop offset="100%" stopColor="#962d22" />
                        </linearGradient>
                        <linearGradient id="brassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#cca300" />
                          <stop offset="50%" stopColor="#f1c40f" />
                          <stop offset="100%" stopColor="#9e7e00" />
                        </linearGradient>
                      </defs>
                      {/* 1. 钢瓶固定框架背板 */}
                      <rect x="10" y="110" width="520" height="6" fill="url(#metalRack)" rx="1.5" stroke="rgba(255,255,255,0.05)" />
                      <rect x="10" y="180" width="520" height="6" fill="url(#metalRack)" rx="1.5" stroke="rgba(255,255,255,0.05)" />
                      <rect x="25" y="80" width="6" height="130" fill="url(#metalRack)" />
                      <rect x="509" y="80" width="6" height="130" fill="url(#metalRack)" />

                      {/* 2. 顶部主集流排主管 (Manifold Pipe) */}
                      <rect x="20" y="18" width="500" height="10" fill="url(#metalRack)" rx="1" stroke="rgba(255,255,255,0.05)" />
                      {/* 主表盘 */}
                      <circle cx="510" cy="23" r="8" fill="#fff" stroke="#333" strokeWidth="1" />
                      <line x1="510" y1="23" x2={isSpraying ? "505" : "515"} y2="18" stroke="#f00" strokeWidth="1.2" style={{ transition: "all 0.5s" }} />

                      {/* 3. 渲染 7 瓶组 */}
                      {Array.from({ length: 7 }).map((_, i) => {
                        const isZS40 = i === 0;
                        const xPos = 40 + i * 66; // horizontal positioning
                        const width = isZS40 ? 18 : 24;
                        const height = isZS40 ? 76 : 100;
                        const yPos = isZS40 ? 134 : 110;
                        
                        const p = press[i] || 0;
                        const maxP = isZS40 && selectedStation === "B" ? 15.0 : (selectedStation === "B" ? 4.2 : 2.0);

                        return (
                          <g key={i}>
                            {/* 软管集流接头 */}
                            <path d={`M ${xPos + width/2} ${yPos - (isZS40 ? 14 : 17)} Q ${xPos + width/2 + (i%2 === 0 ? 10 : -10)} ${yPos - (isZS40 ? 20 : 24)}, ${xPos + width/2} 23`} fill="none" stroke="#2b3a4a" strokeWidth="2" strokeLinecap="round" />

                            {/* 联动控制中心风格的黄铜电磁释放阀头 */}
                            {isZS40 ? (
                              <>
                                <rect x={xPos + width/2 - 3} y={yPos - 12} width="6" height="12" fill="url(#brassGrad)" rx="0.5" />
                                <circle cx={xPos + width/2} cy={yPos - 12} r="3.5" fill="url(#brassGrad)" />
                                <rect x={xPos + width/2 - 5.5} y={yPos - 15} width="11" height="3" fill="url(#brassGrad)" rx="0.5" />
                              </>
                            ) : (
                              <>
                                <rect x={xPos + width/2 - 3.5} y={yPos - 14} width="7" height="14" fill="url(#brassGrad)" rx="0.6" />
                                <circle cx={xPos + width/2} cy={yPos - 14} r="4.2" fill="url(#brassGrad)" />
                                <rect x={xPos + width/2 - 7} y={yPos - 18} width="14" height="4" fill="url(#brassGrad)" rx="0.6" />
                              </>
                            )}

                            {/* 钢瓶罐体 & 精美圆弧肩部 */}
                            <rect x={xPos} y={yPos} width={width} height={height} fill="url(#cylinderGrad)" rx="5" stroke="#5f1d15" strokeWidth="0.8" />
                            {isZS40 ? (
                              <path d={`M ${xPos} ${yPos + 6} C ${xPos} ${yPos - 3}, ${xPos + width} ${yPos - 3}, ${xPos + width} ${yPos + 6} Z`} fill="url(#cylinderGrad)" />
                            ) : (
                              <path d={`M ${xPos} ${yPos + 8} C ${xPos} ${yPos - 4}, ${xPos + width} ${yPos - 4}, ${xPos + width} ${yPos + 8} Z`} fill="url(#cylinderGrad)" />
                            )}

                            {/* 深色金属防震抱箍固定条 */}
                            <rect x={xPos - 1.5} y={yPos + height/3} width={width + 3} height="4" fill="#2c3e50" rx="1.2" />
                            <rect x={xPos - 1.5} y={yPos + (height*2)/3} width={width + 3} height="4" fill="#2c3e50" rx="1.2" />

                            {/* 气压小圆形指示表 */}
                            <g transform={`translate(${xPos + width/2}, ${yPos + 40})`}>
                              <circle cx="0" cy="0" r="8.5" fill="#fff" stroke="#333" strokeWidth="0.8" />
                              <path d="M -5.5 0 A 5.5 5.5 0 0 1 0 -5.5" fill="none" stroke="#ff4d5e" strokeWidth="1.2" />
                              <path d="M 0 -5.5 A 5.5 5.5 0 0 1 5.5 0" fill="none" stroke="var(--green)" strokeWidth="1.2" />
                              {/* 指针偏转 */}
                              <line
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="-5.5"
                                stroke="#111"
                                strokeWidth="1"
                                strokeLinecap="round"
                                transform={`rotate(${Math.min(90, Math.max(-90, (p / maxP) * 180 - 90))})`}
                                style={{ transition: "transform 0.4s ease" }}
                              />
                            </g>

                            {/* 钢瓶规格文字 */}
                            <text x={xPos + width/2} y={yPos + height/2 + 10} fill="rgba(255,255,255,0.7)" fontSize="7" textAnchor="middle" fontWeight="bold">
                              {isZS40 ? "ZS40" : "ZS85"}
                            </text>
                            <text x={xPos + width/2} y={yPos + height/2 + 18} fill="rgba(255,255,255,0.4)" fontSize="5.5" textAnchor="middle">
                              {isZS40 ? "40L" : "85L"}
                            </text>

                            {/* 压力实时数值 */}
                            <text x={xPos + width/2} y={yPos + height + 12} fill={p < 0.2 ? "var(--red)" : "var(--green)"} fontSize="8.5" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                              {p.toFixed(1)}M
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 防护区管网与压力反馈信号监视子页面 */}
      {activeSubTab === "zones" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "fadeIn 0.3s ease-out" }}>
          <div style={{
            background: "rgba(10, 24, 44, 0.65)",
            border: "1px solid var(--line)",
            borderRadius: "14px",
            padding: "16px 24px",
            backdropFilter: "blur(12px)"
          }}>
            <h2 style={{ margin: 0, fontSize: "17px", color: "#fff", fontWeight: "bold" }}>防护区管网部位阀门与压力监测</h2>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>监控五个保护区对应的电磁分配阀、动力回流反馈压力开关状态</span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px"
          }}>
            {[
              { id: "B1_elec", name: "B1配电间", media: "1301 气体灭火", active: method === "1301" && (status === "spraying" || status === "counting" || status === "valves") },
              { id: "F3_office", name: "F3智能办公区", media: "高压细水雾灭火", active: method === "mist" && (status === "spraying" || status === "valves" || status === "pump") },
              { id: "F2_hall", name: "F2多功能会议厅", media: "1301 气体灭火", active: false },
              { id: "B1_pump", name: "B1动力水泵房", media: "高压细水雾灭火", active: false },
              { id: "B1_room", name: "B1发电机房", media: "1301 气体灭火", active: false }
            ].map((zone) => (
              <div key={zone.id} style={{
                background: zone.active ? "rgba(77, 231, 255, 0.05)" : "rgba(14, 28, 48, 0.65)",
                border: zone.active ? "1.5px solid var(--cyan)" : "1px solid var(--line)",
                borderRadius: "12px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                backdropFilter: "blur(10px)",
                boxShadow: zone.active ? "0 0 15px rgba(77, 231, 255, 0.15)" : "none"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "14px", color: "#fff", fontWeight: "bold" }}>{zone.name}</h3>
                    <span style={{ fontSize: "10px", color: "var(--muted)" }}>管网介质: {zone.media}</span>
                  </div>
                  <span style={{
                    background: zone.active ? "rgba(255, 77, 94, 0.15)" : "rgba(255,255,255,0.03)",
                    border: zone.active ? "1px solid var(--red)" : "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "4px",
                    padding: "2px 6px",
                    fontSize: "9px",
                    color: zone.active ? "#ff4d5e" : "var(--muted)",
                    fontWeight: "bold",
                    animation: zone.active ? "flash 1s infinite alternate" : "none"
                  }}>
                    {zone.active ? "🚨 联锁动作中" : "🟢 静态就绪"}
                  </span>
                </div>

                {/* 阀门与压力开关展示图 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "10px" }}>
                  {/* 阀门 SVG */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "9px", color: "var(--muted)" }}>保护区分配阀</span>
                    <svg width="100" height="56" viewBox="0 0 100 56" style={{ overflow: "visible" }}>
                      {/* 管道 */}
                      <rect x="0" y="22" width="100" height="12" fill="#4a5568" rx="1" />
                      {zone.active && (
                        <rect x="0" y="24" width="100" height="8" fill="var(--cyan)" opacity="0.3" style={{ animation: "pulseGlow 1.2s infinite alternate" }} />
                      )}
                      <rect x="25" y="16" width="5" height="24" fill="#718096" />
                      <rect x="70" y="16" width="5" height="24" fill="#718096" />

                      {/* 阀门阀芯 */}
                      <circle cx="50" cy="28" r="14" fill="url(#metalRack)" stroke="#4a5568" strokeWidth="0.8" />
                      <circle cx="50" cy="28" r="9" fill="#1a202c" />

                      {/* 旋转手柄 */}
                      <g transform={`translate(50, 28) rotate(${zone.active ? 90 : 0})`} style={{ transition: "transform 0.5s ease" }}>
                        <line x1="0" y1="-10" x2="0" y2="10" stroke={zone.active ? "var(--green)" : "var(--red)"} strokeWidth="3" strokeLinecap="round" />
                        <circle cx="0" cy="0" r="2.2" fill="#fff" />
                      </g>
                    </svg>
                    <span style={{ fontSize: "9px", color: zone.active ? "var(--green)" : "var(--muted)", fontWeight: "bold" }}>
                      {zone.active ? "阀门开启就绪" : "阀门闭锁状态"}
                    </span>
                  </div>

                  {/* 压力信号反馈器 SVG */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "9px", color: "var(--muted)" }}>信号压力开关</span>
                    <svg width="100" height="56" viewBox="0 0 100 56" style={{ overflow: "visible" }}>
                      <rect x="10" y="6" width="80" height="44" fill="rgba(26, 32, 44, 0.8)" stroke="#4a5568" rx="4" />
                      
                      {/* 接线柱 */}
                      <circle cx="30" cy="28" r="2.8" fill="#d69e2e" />
                      <circle cx="70" cy="28" r="2.8" fill="#d69e2e" />
                      
                      {/* 静态线路 */}
                      <line x1="10" y1="28" x2="27" y2="28" stroke="#718096" strokeWidth="1.2" />
                      <line x1="73" y1="28" x2="90" y2="28" stroke="#718096" strokeWidth="1.2" />

                      {/* 触点动片 */}
                      <line
                        x1="30"
                        y1="28"
                        x2={zone.active ? 70 : 62}
                        y2={zone.active ? 28 : 16}
                        stroke={zone.active ? "var(--green)" : "var(--red)"}
                        strokeWidth="2"
                        strokeLinecap="round"
                        style={{ transition: "all 0.4s ease" }}
                      />

                      {/* 指示灯 */}
                      <circle cx="50" cy="14" r="3.5" fill={zone.active ? "var(--green)" : "#4a5568"} style={{ filter: zone.active ? "drop-shadow(0 0 3px var(--green))" : "none" }} />
                    </svg>
                    <span style={{ fontSize: "9px", color: zone.active ? "var(--green)" : "var(--muted)", fontWeight: "bold" }}>
                      {zone.active ? "反馈动作送出" : "触点断开无信号"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 炫酷的“火警联锁驱动中”提示层 */}
      {showInterlockPrompt && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "360px",
          background: "linear-gradient(135deg, rgba(80, 10, 18, 0.96) 0%, rgba(18, 5, 8, 0.98) 100%)",
          border: "2px solid #ff4d5e",
          borderRadius: "14px",
          padding: "20px",
          boxShadow: "0 10px 32px rgba(255, 77, 94, 0.5), 0 0 15px rgba(255, 77, 94, 0.3)",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          animation: "fadeIn 0.3s cubic-bezier(0.165, 0.84, 0.44, 1)"
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "rgba(255, 77, 94, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Flame size={18} color="#ff4d5e" style={{ animation: "flash 0.6s infinite alternate" }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "13.5px", color: "#fff", fontWeight: "900", letterSpacing: "0.05em" }}>
                🚨 火警联锁防消控制驱动中！
              </h3>
              <span style={{ fontSize: "9px", color: "rgba(255, 255, 255, 0.5)" }}>INTERLOCK SIGNAL DRIVING</span>
            </div>
          </div>

          {/* Details */}
          <div style={{ fontSize: "11.5px", color: "#ffd5d9", lineHeight: "1.5", background: "rgba(0, 0, 0, 0.25)", padding: "10px 12px", borderRadius: "8px" }}>
            系统侦测到回路设备报警：
            <div style={{ fontWeight: "bold", color: "#fff", marginTop: "3px" }}>
              {triggeredAlarmSource || "未知回路探测器"}
            </div>
            防消控制总线已联锁，灭火系统正在响应，请确认真实性。
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            {status === "confirming" ? (
              <button
                onClick={() => {
                  confirmFireAlarm();
                  setShowInterlockPrompt(false);
                }}
                style={{
                  flex: 1,
                  background: "var(--red)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 0 10px rgba(255, 77, 94, 0.5)",
                  transition: "all 0.2s"
                }}
              >
                人工确认为火警 (启动)
              </button>
            ) : (
              <button
                onClick={() => {
                  setActiveSubTab("control");
                  setShowInterlockPrompt(false);
                }}
                style={{
                  flex: 1,
                  background: "var(--cyan)",
                  color: "#000",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                查看联动时序
              </button>
            )}
            <button
              onClick={() => setShowInterlockPrompt(false)}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                color: "var(--muted)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "6px",
                padding: "8px 12px",
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              忽略提示
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
