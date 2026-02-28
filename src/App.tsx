import React, { useEffect, useMemo, useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  AlertTriangle, 
  CheckCircle2, 
  LayoutDashboard, 
  Settings, 
  ShieldAlert, 
  ClipboardList, 
  LogOut, 
  Store,
  Thermometer,
  ArrowRight,
  FileText,
  User as UserIcon,
  Activity,
  Zap,
  Sparkles,
  BrainCircuit,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type User = { id: number; email: string; name: string; role: string; store_id?: number | null };

const Button = ({ className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button 
    {...p} 
    className={`px-4 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors cursor-pointer font-medium text-sm flex items-center gap-2 ${className}`}
  />
);

const Card = ({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: any; key?: React.Key }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="border border-zinc-200 rounded-2xl p-5 bg-white shadow-sm"
  >
    <div className="flex items-center gap-2 font-bold text-zinc-900 mb-4">
      {Icon && <Icon size={18} className="text-zinc-500" />}
      {title}
    </div>
    {children}
  </motion.div>
);

function Badge({ value }: { value: string }) {
  const styles = {
    red: 'bg-red-50 text-red-700 border-red-100',
    yellow: 'bg-amber-50 text-amber-700 border-amber-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100'
  }[value as 'red' | 'yellow' | 'green'] || 'bg-zinc-50 text-zinc-700 border-zinc-100';

  return (
    <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-wider ${styles}`}>
      {value}
    </span>
  );
}

function DeviceHistory({ deviceId, token }: { deviceId: number; token: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/devices/${deviceId}/history`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setData(d.map((x: any) => ({ ...x, time: new Date(x.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [deviceId, token]);

  if (loading) return <div className="h-40 flex items-center justify-center text-zinc-400 animate-pulse">Carregando histórico...</div>;
  if (!data.length) return <div className="h-40 flex items-center justify-center text-zinc-400 italic">Sem dados históricos.</div>;

  return (
    <div className="h-48 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#18181b" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#18181b" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
          <XAxis dataKey="time" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis fontSize={10} tickLine={false} axisLine={false} width={25} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            labelStyle={{ fontWeight: 'bold', fontSize: '10px' }}
          />
          <Area type="monotone" dataKey="value" stroke="#18181b" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function AdminPanel({ token, storeId }: { token: string; storeId: number }) {
  const [devices, setDevices] = useState<any[]>([]);
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>('');

  async function load() {
    const d = await fetch(`/api/admin/devices?store_id=${storeId}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json());
    const t = await fetch(`/api/admin/thresholds`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json());
    setDevices(d);
    setThresholds(t);
  }

  useEffect(() => { load().catch(() => null); }, [storeId]);

  async function saveThreshold(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    const payload = {
      sector_code: String(form.get('sector_code') || ''),
      device_type: String(form.get('device_type') || 'temp'),
      min_value: form.get('min_value') === '' ? null : Number(form.get('min_value')),
      max_value: form.get('max_value') === '' ? null : Number(form.get('max_value')),
      notes: String(form.get('notes') || '')
    };
    const r = await fetch('/api/admin/thresholds', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return setMsg('Falha ao salvar threshold');
    setMsg('Threshold salvo');
    load().catch(() => null);
    (e.target as HTMLFormElement).reset();
  }

  async function saveDevice(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    const payload = {
      store_id: Number(form.get('store_id') || storeId),
      sector_code: String(form.get('sector_code') || 'deli'),
      device_uid: String(form.get('device_uid') || ''),
      device_type: String(form.get('device_type') || 'temp'),
      location: String(form.get('location') || ''),
      is_active: true
    };
    const r = await fetch('/api/admin/devices', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return setMsg('Falha ao salvar dispositivo');
    setMsg('Dispositivo salvo');
    load().catch(() => null);
    (e.target as HTMLFormElement).reset();
  }

  async function simulateReading(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    const payload = {
      store_id: storeId,
      device_uid: String(form.get('device_uid')),
      device_type: String(form.get('device_type')),
      sector_code: String(form.get('sector_code')),
      value: Number(form.get('value')),
      unit: form.get('device_type') === 'temp' || form.get('device_type') === 'hot' ? '°C' : '%'
    };
    const r = await fetch('/api/iot/reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) setMsg('Leitura simulada enviada com sucesso!');
    else setMsg('Erro ao simular leitura');
  }

  async function saveSalesRun(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    const payload = {
      api_key: String(form.get('api_key') || ''),
      webhook_url: String(form.get('webhook_url') || '')
    };
    const r = await fetch(`/api/stores/${storeId}/integrations/salesrun`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return setMsg('Falha ao salvar integração SalesRun');
    setMsg('Integração SalesRun configurada!');
  }

  return (
    <div className="grid gap-6">
      {msg && <div className="text-xs text-zinc-600 bg-zinc-100 p-2 rounded-lg">{msg}</div>}

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Simulador IoT" icon={Zap}>
          <form onSubmit={simulateReading} className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <select name="sector_code" className="p-2.5 rounded-xl border border-zinc-200 text-sm">
                <option value="butchery">Açougue</option>
                <option value="flv">FLV</option>
                <option value="bakery">Padaria</option>
                <option value="rotisserie">Rotisseria</option>
                <option value="deli">Frios/Fatiados</option>
              </select>
              <select name="device_type" className="p-2.5 rounded-xl border border-zinc-200 text-sm">
                <option value="temp">Frio</option>
                <option value="hot">Quente</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input name="device_uid" placeholder="UID (ex: SENS-AC-01)" className="p-2.5 rounded-xl border border-zinc-200 text-sm" />
              <input name="value" type="number" step="0.1" placeholder="Valor" className="p-2.5 rounded-xl border border-zinc-200 text-sm" />
            </div>
            <Button type="submit" className="w-full justify-center bg-amber-500 text-white border-none hover:bg-amber-600">Disparar Leitura</Button>
          </form>
        </Card>

        <Card title="Cadastrar dispositivo" icon={Settings}>
          <form onSubmit={saveDevice} className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <input name="store_id" defaultValue={String(storeId)} placeholder="Loja" className="p-2.5 rounded-xl border border-zinc-200 text-sm" />
              <select name="sector_code" className="p-2.5 rounded-xl border border-zinc-200 text-sm">
                <option value="butchery">Açougue</option>
                <option value="flv">FLV</option>
                <option value="bakery">Padaria</option>
                <option value="rotisserie">Rotisseria</option>
                <option value="deli">Frios/Fatiados</option>
              </select>
            </div>
            <select name="device_type" className="p-2.5 rounded-xl border border-zinc-200 text-sm">
              <option value="temp">Temperatura (frio)</option>
              <option value="hot">Temperatura (quente)</option>
              <option value="door">Porta</option>
              <option value="power">Energia</option>
            </select>
            <input name="device_uid" placeholder="device_uid (ex: CAMARA-01)" className="p-2.5 rounded-xl border border-zinc-200 text-sm" />
            <input name="location" placeholder="Local (ex: Câmara frios)" className="p-2.5 rounded-xl border border-zinc-200 text-sm" />
            <Button type="submit" className="w-full justify-center bg-zinc-900 text-white border-none hover:bg-zinc-800">Salvar Dispositivo</Button>
          </form>
        </Card>

        <Card title="Ajustar limites" icon={Thermometer}>
          <form onSubmit={saveThreshold} className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <select name="sector_code" className="p-2.5 rounded-xl border border-zinc-200 text-sm">
                <option value="butchery">Açougue</option>
                <option value="flv">FLV</option>
                <option value="bakery">Padaria</option>
                <option value="rotisserie">Rotisseria</option>
                <option value="deli">Frios/Fatiados</option>
              </select>
              <select name="device_type" className="p-2.5 rounded-xl border border-zinc-200 text-sm">
                <option value="temp">Frio</option>
                <option value="hot">Quente</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input name="min_value" placeholder="Min" className="p-2.5 rounded-xl border border-zinc-200 text-sm" />
              <input name="max_value" placeholder="Max" className="p-2.5 rounded-xl border border-zinc-200 text-sm" />
            </div>
            <input name="notes" placeholder="Observações" className="p-2.5 rounded-xl border border-zinc-200 text-sm" />
            <Button type="submit" className="w-full justify-center bg-zinc-900 text-white border-none hover:bg-zinc-800">Salvar Limites</Button>
          </form>
        </Card>

        <Card title="Integração SalesRun.io" icon={Activity}>
          <form onSubmit={saveSalesRun} className="grid gap-4">
            <p className="text-[10px] text-zinc-500 leading-tight">
              Sincronize alertas críticos e ações corretivas diretamente com o SalesRun para execução em campo.
            </p>
            <input name="webhook_url" placeholder="Webhook URL (https://salesrun.io/api/webhook/...)" className="p-2.5 rounded-xl border border-zinc-200 text-sm" />
            <input name="api_key" type="password" placeholder="SalesRun API Key" className="p-2.5 rounded-xl border border-zinc-200 text-sm" />
            <Button type="submit" className="w-full justify-center bg-blue-600 text-white border-none hover:bg-blue-700">Configurar Integração</Button>
          </form>
        </Card>
      </div>

      <Card title="Dispositivos Cadastrados" icon={Store}>
        <div className="grid gap-4 md:grid-cols-2">
          {devices?.length ? devices.map(d => (
            <div key={d.id} className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-zinc-900">{d.sector}</div>
                  <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">{d.device_uid} • {d.location}</div>
                </div>
                <Badge value={d.device_type === 'hot' ? 'yellow' : 'green'} />
              </div>
              <DeviceHistory deviceId={d.id} token={token} />
            </div>
          )) : <div className="text-sm text-zinc-400 text-center py-4 col-span-2">Sem dispositivos cadastrados.</div>}
        </div>
      </Card>
    </div>
  );
}

function AIAssistant({ dash, alerts, actions }: { dash: any; alerts: any[]; actions: any[] }) {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY as string) });
      const prompt = `Analise o estado atual desta loja de varejo alimentar:
        - Score de Risco: ${dash?.risk_score}/100
        - Conformidade: ${dash?.compliance_pct_24h}%
        - Alertas Críticos: ${dash?.red_alerts}
        - Alertas de Atenção: ${dash?.yellow_alerts}
        - Ações Pendentes: ${dash?.open_actions}
        
        Alertas Recentes: ${JSON.stringify(alerts.slice(0, 5))}
        Ações em Aberto: ${JSON.stringify(actions.slice(0, 5))}
        
        Forneça um briefing executivo curto (máximo 4 parágrafos) em Português:
        1. Avaliação imediata da segurança alimentar.
        2. Identificação do setor mais problemático.
        3. Recomendação prioritária para o gerente.
        4. Insight preditivo baseado no score.
        
        Use um tom profissional, técnico e direto.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAnalysis(response.text || 'Não foi possível gerar a análise.');
    } catch (e) {
      setAnalysis('Erro ao conectar com a Inteligência Artificial. Verifique a configuração da API.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="technical-card border-zinc-900 bg-zinc-900 text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg">
            <BrainCircuit size={24} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-none">Gemini AI Auditor</h3>
            <p className="text-[10px] uppercase tracking-widest opacity-50 mt-1">Análise Estratégica em Tempo Real</p>
          </div>
        </div>
        <button 
          onClick={runAnalysis} 
          disabled={loading}
          className="technical-button border-white hover:bg-white hover:text-zinc-900 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Analisando...' : 'Gerar Briefing'}
        </button>
      </div>

      {analysis ? (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="space-y-4 text-sm leading-relaxed text-zinc-300 font-light"
        >
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl whitespace-pre-wrap italic">
            {analysis}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter opacity-40">
            <Activity size={10} /> Processado por Gemini 3 Flash • {new Date().toLocaleTimeString()}
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-zinc-500 text-center">
          <Sparkles size={32} className="mb-3 opacity-20" />
          <p className="text-xs italic">Clique no botão acima para que a IA analise os dados operacionais da loja e forneça recomendações estratégicas.</p>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [token, _setToken] = useState(localStorage.getItem('ssajb_token') || '');
  const [user, setUser] = useState<User | null>(null);
  const [menu, setMenu] = useState<'painel' | 'alertas' | 'acoes' | 'auditoria' | 'admin'>('painel');
  const [storeId, setStoreId] = useState<number>(1);
  const [dash, setDash] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [actionStatus, setActionStatus] = useState<string>('open');
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'alert' | 'info' }[]>([]);
  const isAuthed = !!token;

  function addToast(msg: string, type: 'alert' | 'info' = 'info') {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }

  async function downloadPdf(days: number) {
    const r = await fetch(`/api/stores/${storeId}/audit/pdf?days=${days}`, { 
      headers: { 'Authorization': `Bearer ${token}` } 
    });
    if (!r.ok) return alert('Falha ao gerar relatório');
    const blob = await r.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_loja_${storeId}_${days}dias.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  useEffect(() => {
    if (!isAuthed) return;
    const fetchMe = async () => {
      const r = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) setUser(await r.json());
      else logout();
    };
    fetchMe();
  }, [isAuthed, token]);

  useEffect(() => {
    if (user?.store_id) setStoreId(user.store_id);
  }, [user]);

  const allowedMenus = useMemo(() => {
    if (!user) return ['painel'] as const;
    if (user.role === 'operator') return ['painel', 'alertas', 'acoes'] as const;
    if (user.role === 'manager') return ['painel', 'alertas', 'acoes', 'auditoria'] as const;
    if (user.role === 'ssa') return ['painel', 'alertas', 'acoes', 'auditoria', 'admin'] as const;
    return ['painel', 'alertas', 'acoes', 'auditoria'] as const;
  }, [user]);

  useEffect(() => {
    if (!isAuthed) return;
    const loadData = async () => {
      try {
        const d = await fetch(`/api/stores/${storeId}/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json());
        const al = await fetch(`/api/stores/${storeId}/alerts?open_only=true`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json());
        
        // Check for new alerts to toast
        if (alerts.length > 0 && al.length > alerts.length) {
          const newAlerts = al.filter((x: any) => !alerts.find((y: any) => y.id === x.id));
          newAlerts.forEach((a: any) => addToast(`Novo Alerta: ${a.title}`, 'alert'));
        }

        const ac = await fetch(`/api/stores/${storeId}/actions?status=${actionStatus}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json());
        setDash(d);
        setAlerts(al);
        setActions(ac);
      } catch (e) {}
    };
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [isAuthed, storeId, token, actionStatus]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    const username = String(form.get('email') || '');
    const password = String(form.get('password') || '');
    const r = await fetch('/api/auth/token', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }) 
    });
    if (!r.ok) {
      const errorData = await r.json().catch(() => ({}));
      return alert(errorData.error || 'Falha no login');
    }
    const j = await r.json();
    localStorage.setItem('ssajb_token', j.access_token);
    _setToken(j.access_token);
  }

  function logout() {
    localStorage.removeItem('ssajb_token');
    _setToken('');
    setUser(null);
  }

  async function completeAction(id: number) {
    const evidence = {
      photo_url: `https://picsum.photos/seed/${id}/400/300`,
      timestamp: new Date().toISOString(),
      note: 'Ação concluída conforme instrução.'
    };
    const r = await fetch(`/api/actions/${id}/complete`, { 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidence })
    });
    if (!r.ok) return alert('Não foi possível concluir');
    addToast('Ação concluída com sucesso!', 'info');
    setActions(a => a.filter(x => x.id !== id));
  }

  async function resolveAlert(id: number) {
    const r = await fetch(`/api/alerts/${id}/resolve?resolution=Resolvido%20na%20loja`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    if (!r.ok) return alert('Não foi possível resolver');
    setAlerts(a => a.filter(x => x.id !== id));
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Toasts */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
          <AnimatePresence>
            {toasts.map(t => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "p-4 rounded-2xl shadow-2xl border flex items-center gap-3 min-w-[280px]",
                  t.type === 'alert' ? "bg-red-600 border-red-500 text-white" : "bg-white border-zinc-200 text-zinc-900"
                )}
              >
                {t.type === 'alert' ? <ShieldAlert size={20} /> : <Activity size={20} />}
                <div className="text-sm font-bold">{t.msg}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white">
              <ShieldAlert size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">SSA</h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Segurança do Alimento</p>
            </div>
          </div>
          
          {isAuthed && (
            <div className="flex items-center gap-4 bg-white p-2 pr-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500">
                <UserIcon size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold leading-tight">{user?.name}</div>
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                  {user?.role} {user?.store_id ? `• Loja ${String(user.store_id).padStart(2, '0')}` : ''}
                </div>
              </div>
              <button onClick={logout} className="p-2 text-zinc-400 hover:text-red-500 transition-colors">
                <LogOut size={18} />
              </button>
            </div>
          )}
        </header>

        {!isAuthed ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto">
            <Card title="Acesso ao Sistema" icon={ShieldAlert}>
              <form onSubmit={login} className="grid gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">E-mail</label>
                  <input name="email" placeholder="ex: operador@loja.com" className="w-full p-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Senha</label>
                  <input name="password" type="password" placeholder="••••••••" className="w-full p-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none transition-all" />
                </div>
                <Button type="submit" className="w-full justify-center bg-zinc-900 text-white border-none h-12 text-base hover:bg-zinc-800">
                  Entrar no Sistema
                </Button>
                <div className="mt-4 p-4 bg-zinc-100 rounded-xl text-[11px] text-zinc-500 leading-relaxed">
                  <span className="font-bold text-zinc-700 block mb-1">Credenciais de Teste:</span>
                  operador@loja.com / gerente@loja.com / ssa@empresa.com / auditor@empresa.com (senha: senha123)
                </div>
              </form>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Navigation */}
            <nav className="flex flex-wrap gap-2 items-center">
              {allowedMenus.map(m => (
                <button 
                  key={m} 
                  onClick={() => setMenu(m)} 
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                    menu === m 
                    ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-200' 
                    : 'bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {m === 'painel' && <LayoutDashboard size={16} />}
                  {m === 'alertas' && <ShieldAlert size={16} />}
                  {m === 'acoes' && <ClipboardList size={16} />}
                  {m === 'auditoria' && <FileText size={16} />}
                  {m === 'admin' && <Settings size={16} />}
                  <span className="capitalize">{m}</span>
                </button>
              ))}
              
              {(user?.role === 'ssa' || user?.role === 'auditor') && (
                <div className="ml-auto flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-zinc-200">
                  <span className="text-[10px] font-black text-zinc-400 uppercase">Loja</span>
                  <input 
                    type="number" 
                    value={storeId} 
                    onChange={(e) => setStoreId(Number(e.target.value || 1))} 
                    className="w-12 text-sm font-bold outline-none"
                  />
                </div>
              )}
            </nav>

            <AnimatePresence mode="wait">
              {menu === 'painel' && (
                <motion.div 
                  key="painel"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                  <Card title="Score de Risco" icon={AlertTriangle}>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black tracking-tighter">{dash?.risk_score ?? '-'}</span>
                      <span className="text-zinc-400 font-bold text-sm">/ 100</span>
                    </div>
                    <div className="mt-4 h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${dash?.risk_score > 70 ? 'bg-red-500' : dash?.risk_score > 35 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${dash?.risk_score ?? 0}%` }}
                      />
                    </div>
                    
                    {/* Tiny trend chart */}
                    <div className="h-16 w-full mt-4 opacity-50">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[
                          { v: 10 }, { v: 15 }, { v: 12 }, { v: 25 }, { v: 20 }, { v: dash?.risk_score ?? 0 }
                        ]}>
                          <Line type="monotone" dataKey="v" stroke="#18181b" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card title="Conformidade" icon={CheckCircle2}>
                    <div className="text-5xl font-black tracking-tighter">{dash ? Math.round(dash.compliance_pct_24h) : '-'}%</div>
                    <p className="text-xs text-zinc-400 mt-2 font-medium">Média operacional das últimas 24h</p>
                  </Card>

                  <Card title="Pendências" icon={ClipboardList}>
                    <div className="flex gap-6">
                      <div>
                        <div className="text-3xl font-black text-red-600">{dash?.red_alerts ?? 0}</div>
                        <div className="text-[10px] font-bold uppercase text-zinc-400">Críticos</div>
                      </div>
                      <div className="w-px h-10 bg-zinc-100" />
                      <div>
                        <div className="text-3xl font-black text-amber-600">{dash?.yellow_alerts ?? 0}</div>
                        <div className="text-[10px] font-bold uppercase text-zinc-400">Alertas</div>
                      </div>
                      <div className="w-px h-10 bg-zinc-100" />
                      <div>
                        <div className="text-3xl font-black text-zinc-900">{dash?.open_actions ?? 0}</div>
                        <div className="text-[10px] font-bold uppercase text-zinc-400">Ações</div>
                      </div>
                    </div>
                  </Card>

                  <div className="md:col-span-3">
                    <AIAssistant dash={dash} alerts={alerts} actions={actions} />
                  </div>

                  <div className="md:col-span-2">
                    <Card title="Alertas por Setor" icon={Store}>
                      <div className="space-y-3">
                        {dash?.top_sectors?.length ? dash.top_sectors.map((s: any) => (
                          <div key={s.sector} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                            <span className="font-bold text-zinc-700">{s.sector}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black">{s.open_alerts}</span>
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            </div>
                          </div>
                        )) : <div className="text-sm text-zinc-400 text-center py-8 italic">Nenhum alerta ativo no momento.</div>}
                      </div>
                    </Card>
                  </div>

                  <Card title="Ações Rápidas" icon={ArrowRight}>
                    <div className="grid gap-3">
                      <Button onClick={() => setMenu('alertas')} className="w-full justify-between group">
                        Ver Alertas Ativos <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </Button>
                      <Button onClick={() => setMenu('acoes')} className="w-full justify-between group">
                        Executar Ações <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </Button>
                      <Button onClick={() => setMenu('auditoria')} className="w-full justify-between group">
                        Relatório de Auditoria <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}

              {menu === 'alertas' && (
                <motion.div 
                  key="alertas"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  {alerts.length === 0 ? (
                    <Card title="Alertas Ativos">
                      <div className="text-center py-12 text-zinc-400 italic">Tudo sob controle. Sem alertas abertos.</div>
                    </Card>
                  ) : alerts.map(a => (
                    <Card key={a.id} title={a.title} icon={ShieldAlert}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Badge value={a.severity} />
                            <span className="text-xs text-zinc-400 font-medium">{new Date(a.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-zinc-600 leading-relaxed">{a.detail}</p>
                        </div>
                        {['manager', 'ssa', 'auditor'].includes(user?.role || '') && (
                          <Button onClick={() => resolveAlert(a.id)} className="bg-zinc-900 text-white border-none hover:bg-zinc-800 shrink-0">
                            Resolver Alerta
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </motion.div>
              )}

              {menu === 'acoes' && (
                <motion.div 
                  key="acoes"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm w-fit">
                    <span className="text-[10px] font-black text-zinc-400 uppercase px-2">Filtrar:</span>
                    {(['open', 'done', 'escalated'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setActionStatus(s)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all capitalize ${
                          actionStatus === s 
                          ? 'bg-zinc-900 text-white' 
                          : 'text-zinc-500 hover:bg-zinc-50'
                        }`}
                      >
                        {s === 'open' ? 'Abertas' : s === 'done' ? 'Concluídas' : 'Escalonadas'}
                      </button>
                    ))}
                  </div>

                  {actions.length === 0 ? (
                    <Card title={`Ações (${actionStatus})`}>
                      <div className="text-center py-12 text-zinc-400 italic">Nenhuma ação encontrada com este status.</div>
                    </Card>
                  ) : actions.map(a => (
                    <Card key={a.id} title={a.title} icon={ClipboardList}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-400 font-medium">{new Date(a.created_at).toLocaleString()}</span>
                            {a.status === 'done' && <Badge value="green" />}
                          </div>
                          <p className="text-sm text-zinc-600 leading-relaxed">{a.instruction}</p>
                        </div>
                        {a.status !== 'done' && (
                          <Button onClick={() => completeAction(a.id)} className="bg-emerald-600 text-white border-none hover:bg-emerald-700 shrink-0">
                            Concluir Ação
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </motion.div>
              )}

              {menu === 'auditoria' && (
                <motion.div 
                  key="auditoria"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                >
                  <Card title="Relatórios de Auditoria" icon={FileText}>
                    <div className="space-y-6">
                      <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-3">
                        <h4 className="font-bold text-sm">Auditoria Digital Automática</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                          O sistema SSA consolida automaticamente todas as leituras de sensores, alertas gerados e o tempo de resposta das ações operacionais para fins de compliance e auditoria sanitária.
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 border border-zinc-100 rounded-2xl bg-white hover:border-zinc-300 transition-all group cursor-pointer">
                          <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 mb-4 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                            <FileText size={20} />
                          </div>
                          <h5 className="font-bold text-sm mb-1">Relatório Semanal</h5>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-4">Últimos 7 dias</p>
                          <Button onClick={() => downloadPdf(7)} className="w-full justify-center">Gerar PDF</Button>
                        </div>
                        
                        <div className="p-5 border border-zinc-100 rounded-2xl bg-white hover:border-zinc-300 transition-all group cursor-pointer">
                          <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 mb-4 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                            <FileText size={20} />
                          </div>
                          <h5 className="font-bold text-sm mb-1">Relatório Mensal</h5>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-4">Últimos 30 dias</p>
                          <Button onClick={() => downloadPdf(30)} className="w-full justify-center">Gerar PDF</Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              {menu === 'admin' && (
                <motion.div 
                  key="admin"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <AdminPanel token={token} storeId={storeId} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
