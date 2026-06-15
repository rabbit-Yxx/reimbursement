import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'

export default function SettingsPage() {
  const { config, saveConfig, addToast } = useApp()
  const [mealLimit, setMealLimit] = useState(config.mealLimit)
  const [taxiLimit, setTaxiLimit] = useState(config.taxiLimit)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setMealLimit(config.mealLimit)
    setTaxiLimit(config.taxiLimit)
  }, [config])

  const handleSave = async () => {
    await saveConfig({ mealLimit: Number(mealLimit), taxiLimit: Number(taxiLimit) })
    setSaved(true)
    addToast('设置已保存', 'success')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>⚙️ 设置</h1>
        <p>配置每日报销上限和其他选项</p>
      </div>

      <div style={{ maxWidth: 560 }}>
        <div className="card mb-4">
          <div className="card-header">
            <div className="card-title">💰 每日报销上限</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">每日餐费上限（元）</label>
              <input
                className="input"
                type="number"
                min="0"
                value={mealLimit}
                onChange={e => setMealLimit(e.target.value)}
              />
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                同一天所有餐费发票合计超出此金额时将给出提醒
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">每日打车费上限（元）</label>
              <input
                className="input"
                type="number"
                min="0"
                value={taxiLimit}
                onChange={e => setTaxiLimit(e.target.value)}
              />
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                滴滴和出租车费用合并计算，超出此金额时将给出提醒
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleSave}>
                {saved ? '✅ 已保存' : '保存设置'}
              </button>
              <button className="btn btn-secondary" onClick={() => {
                setMealLimit(140); setTaxiLimit(112)
              }}>
                恢复默认值
              </button>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <div className="card-title">📍 住宿费标准</div>
          </div>
          <div className="alert alert-info">
            <span>ℹ️</span>
            <div>
              住宿费标准因城市而异，请在「报销标准查询」模块上传公司报销标准文件后，
              超标检测时输入出差目的地城市，系统将自动读取对应城市的住宿上限。
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">🤖 AI 增强（即将推出）</div>
            <span className="badge badge-neutral">开发中</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            后续版本将支持接入 LLM 大模型，实现更准确的文件识别和自然语言报销标准问答。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.5, pointerEvents: 'none' }}>
            <div className="input-group">
              <label className="input-label">LLM 提供商</label>
              <select className="select">
                <option>Anthropic Claude</option>
                <option>OpenAI GPT</option>
                <option>通义千问</option>
                <option>DeepSeek</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">API Key</label>
              <input className="input" type="password" placeholder="sk-..." disabled />
            </div>
            <button className="btn btn-primary" disabled>保存 API 配置</button>
          </div>
        </div>
      </div>
    </div>
  )
}
