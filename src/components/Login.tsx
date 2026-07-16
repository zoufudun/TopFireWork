import { ShieldAlert, RadioTower, Lock, User, Key, EyeOff } from "lucide-react";
import { useState } from "react";
import { useFireStore } from "../store/useFireStore";

export function Login() {
  const { login } = useFireStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("••••••••");
  const [selectedMode, setSelectedMode] = useState<"training" | "real">("training");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = username.trim() || (selectedMode === "training" ? "模拟调试员-A" : "安全监查员-B");
    login(selectedMode, finalName);
  };

  return (
    <div className="login-container">
      {/* 动态的网格和霓虹微光背景 */}
      <div className="login-bg-grid" />
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <ShieldAlert size={28} className="logo-icon animate-pulse" />
          </div>
          <h2>TOPFIRE 安全联动与数字孪生工作台</h2>
          <p className="login-subtitle">请选择控制权级并登入消防系统主控终端</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label><User size={14} /> 操作员签名 (姓名)</label>
            <input
              type="text"
              placeholder={selectedMode === "training" ? "例如：操盘员-SIM" : "例如：监视员-REAL"}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
            />
          </div>

          <div className="input-group">
            <label><Key size={14} /> 电子密匙授权密码</label>
            <div className="password-input-wrapper">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input password-input"
              />
              <EyeOff size={14} className="password-toggle-icon" />
            </div>
          </div>

          <div className="mode-selection-container">
            <label className="section-label">⚡ 物理链路主控模式选择</label>
            <div className="mode-cards">
              {/* 模拟训练 Card */}
              <div
                className={`mode-card training-card ${selectedMode === "training" ? "active" : ""}`}
                onClick={() => setSelectedMode("training")}
              >
                <div className="mode-card-header">
                  <RadioTower size={18} className="mode-icon text-cyan" />
                  <h4>模拟训练模式</h4>
                </div>
                <p>
                  启用虚拟仿真引擎。支持在拓扑中注入故障、模拟火警触发，测试联动灭火及延时自控系统。
                </p>
                <div className="badge training-badge">SIMULATION</div>
              </div>

              {/* 真实现实 Card */}
              <div
                className={`mode-card real-card ${selectedMode === "real" ? "active" : ""}`}
                onClick={() => setSelectedMode("real")}
              >
                <div className="mode-card-header">
                  <Lock size={18} className="mode-icon text-red" />
                  <h4>真实现实模式</h4>
                </div>
                <p>
                  实时读取物理消防控制柜数据。出于物理安全防线要求，此模式下消音、复位及联动触发控制指令<b>完全闭锁</b>。
                </p>
                <div className="badge real-badge">READONLY</div>
              </div>
            </div>
          </div>

          <button type="submit" className="login-submit-btn">
            授权并初始化系统终端
          </button>
        </form>

        <div className="login-footer-notice">
          <ShieldAlert size={12} style={{ marginRight: 4, display: "inline" }} />
          警告：本系统可进行灭火药剂释放仿真，进入真实现实模式需遵守消防中控安全管理规定。
        </div>
      </div>
    </div>
  );
}
