
import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine, Line, ComposedChart, Legend
} from 'recharts';
import { 
  TrendingUp, Home, Car, Users, DollarSign, Calendar, ShieldCheck, Zap, Target, Clock, User, BarChart3, Rocket, ShieldAlert, Activity, Info, RefreshCcw, Cake, Search, ExternalLink, Briefcase, Compass, Baby, School, GraduationCap, ArrowUpCircle, PiggyBank, AlertTriangle, ChevronDown, ChevronUp, Table, FastForward
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// --- 安全的 API Key 取得方式 ---
const getApiKey = () => {
  try {
    return process.env.API_KEY || "";
  } catch (e) {
    return "";
  }
};

const getAiClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

const SWR_DEFAULT = 0.04; 
const STORAGE_KEY = 'NEXUS_FIRE_PROFILE_V9'; 

const EDU_COSTS = {
  KINDERGARTEN: 18000, 
  ELEMENTARY: 8000,    
  JUNIOR_HIGH: 10000,  
  SENIOR_HIGH: 12000,  
  UNIVERSITY: 20000,   
  GRADUATE: 22000      
};

interface ChildProfile {
  birthYear: number;
  birthMonth: number;
  isPrivateSchool: boolean; 
}

interface UserProfile {
  monthlyIncome: number;
  basicLivingExpenses: number;
  mortgage: number;
  mortgageMonths: number;
  carLoan: number;
  carLoanMonths: number;
  currentAssets: number;
  annualReturn: number;
  monthlyEtfInvestment: number; 
  kids: ChildProfile[];
  birthYear: number;
  birthMonth: number;
  baseAssetDate: number; 
}

type ScenarioMode = 'current' | 'aggressive' | 'conservative';

const getDecimalAge = (birthYear: number, birthMonth: number, targetDate: Date = new Date()) => {
  const yearDiff = targetDate.getFullYear() - birthYear;
  const monthDiff = targetDate.getMonth() + 1 - birthMonth;
  return yearDiff + (monthDiff / 12);
};

const getMonthlyEduCost = (age: number, isPrivate: boolean) => {
  let base = 0;
  if (age < 3) base = 15000; 
  else if (age < 6) base = EDU_COSTS.KINDERGARTEN;
  else if (age < 12) base = EDU_COSTS.ELEMENTARY;
  else if (age < 15) base = EDU_COSTS.JUNIOR_HIGH;
  else if (age < 18) base = EDU_COSTS.SENIOR_HIGH;
  else if (age < 22) base = EDU_COSTS.UNIVERSITY;
  else if (age < 24) base = EDU_COSTS.GRADUATE;
  else return 0; 
  return isPrivate ? base * 1.5 : base;
};

function NexusFIRE() {
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const now = new Date();
    const initial = {
      monthlyIncome: 160000, 
      basicLivingExpenses: 55000,
      mortgage: 25000,
      mortgageMonths: 240, 
      carLoan: 12000,
      carLoanMonths: 72,
      currentAssets: 1500000,
      annualReturn: 7,
      monthlyEtfInvestment: 20000,
      kids: [
        { birthYear: now.getFullYear() - 8, birthMonth: 5, isPrivateSchool: false },
        { birthYear: now.getFullYear() - 5, birthMonth: 10, isPrivateSchool: false }
      ],
      birthYear: now.getFullYear() - 38,
      birthMonth: now.getMonth() + 1,
      baseAssetDate: now.getTime()
    };
    if (saved) {
      try { return { ...initial, ...JSON.parse(saved) }; } catch (e) { return initial; }
    }
    return initial;
  });

  const [targetMonthlyBudget, setTargetMonthlyBudget] = useState<number>(80000);
  const [targetRetireAge, setTargetRetireAge] = useState<number>(55);
  const [mode, setMode] = useState<ScenarioMode>('current');
  const [aiMessage, setAiMessage] = useState<string>("分析資產複利動態中...");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [stockAdvice, setStockAdvice] = useState<string>("");
  const [isStockLoading, setIsStockLoading] = useState(false);
  const [showDetailTable, setShowDetailTable] = useState(false);

  const liveState = useMemo(() => {
    const now = new Date();
    const baseDate = new Date(profile.baseAssetDate);
    const monthsElapsed = Math.max(0, (now.getFullYear() - baseDate.getFullYear()) * 12 + (now.getMonth() - baseDate.getMonth()));
    const currentAge = getDecimalAge(profile.birthYear, profile.birthMonth, now);
    const currentMortgageMonths = Math.max(0, profile.mortgageMonths - monthsElapsed);
    const currentCarLoanMonths = Math.max(0, profile.carLoanMonths - monthsElapsed);
    let autoAssets = profile.currentAssets;
    const monthlyReturnRate = (profile.annualReturn / 100) / 12;
    for (let i = 0; i < monthsElapsed; i++) {
      const simDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i);
      const hasMortgage = i < profile.mortgageMonths;
      const hasCarLoan = i < profile.carLoanMonths;
      let totalEduCost = 0;
      profile.kids.forEach(child => {
        const childAge = getDecimalAge(child.birthYear, child.birthMonth, simDate);
        totalEduCost += getMonthlyEduCost(childAge, child.isPrivateSchool);
      });
      const monthlySavings = profile.monthlyIncome - (profile.basicLivingExpenses + totalEduCost + (hasMortgage ? profile.mortgage : 0) + (hasCarLoan ? profile.carLoan : 0));
      autoAssets = (autoAssets * (1 + monthlyReturnRate)) + monthlySavings;
    }
    return { currentAge, currentMortgageMonths, currentCarLoanMonths, currentAssets: Math.round(autoAssets), monthsElapsed };
  }, [profile]);

  const reversePlanning = useMemo(() => {
    const assetsNeededForBudget = (targetMonthlyBudget * 12) / SWR_DEFAULT;
    const yearsUntilTargetAge = Math.max(0.1, targetRetireAge - liveState.currentAge);
    const totalMonths = Math.round(yearsUntilTargetAge * 12);
    const monthlyReturnRate = (profile.annualReturn / 100) / 12;
    const compoundFactor = Math.pow(1 + monthlyReturnRate, totalMonths);
    const requiredMonthlySaving = (assetsNeededForBudget - liveState.currentAssets * compoundFactor) * monthlyReturnRate / (compoundFactor - 1);
    
    // 計算「固定版」與「加速版(含債務釋放)」達標時間
    let etfYearsToTarget = 0;
    let accEtfYearsToTarget = 0;
    let etfAssets = liveState.currentAssets;
    let accEtfAssets = liveState.currentAssets;

    for (let m = 1; m <= 600; m++) {
      // 靜態固定投入
      etfAssets = (etfAssets * (1 + monthlyReturnRate)) + profile.monthlyEtfInvestment;
      if (etfAssets >= assetsNeededForBudget && etfYearsToTarget === 0) etfYearsToTarget = m / 12;

      // 加速版：考慮債務消失後轉入 ETF
      const mortgageReinvest = m >= liveState.currentMortgageMonths ? profile.mortgage : 0;
      const carReinvest = m >= liveState.currentCarLoanMonths ? profile.carLoan : 0;
      accEtfAssets = (accEtfAssets * (1 + monthlyReturnRate)) + (profile.monthlyEtfInvestment + mortgageReinvest + carReinvest);
      if (accEtfAssets >= assetsNeededForBudget && accEtfYearsToTarget === 0) accEtfYearsToTarget = m / 12;
    }

    let initialEduCost = 0;
    profile.kids.forEach(child => {
      const childAge = getDecimalAge(child.birthYear, child.birthMonth);
      initialEduCost += getMonthlyEduCost(childAge, child.isPrivateSchool);
    });
    const currentAverageMonthlySavings = profile.monthlyIncome - (profile.basicLivingExpenses + initialEduCost + 
      (liveState.currentMortgageMonths > 0 ? profile.mortgage : 0) + 
      (liveState.currentCarLoanMonths > 0 ? profile.carLoan : 0));
    
    return { 
      assetsNeededForBudget, 
      requiredMonthlySaving: Math.max(0, Math.round(requiredMonthlySaving)), 
      savingsGap: Math.max(0, Math.round(requiredMonthlySaving - currentAverageMonthlySavings)),
      etfYearsToTarget,
      accEtfYearsToTarget
    };
  }, [profile, liveState, targetMonthlyBudget, targetRetireAge]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }, [profile]);

  const calculateForParams = (p: UserProfile, live: any, expenseMult: number, returnMod: number) => {
    const adjAnnualReturn = p.annualReturn + returnMod;
    const adjBasicExp = p.basicLivingExpenses * expenseMult;
    const fireTarget = (targetMonthlyBudget * 12) / SWR_DEFAULT;
    let yearsToFire = 0;
    let currentWealth = live.currentAssets;
    const history = [];
    for (let month = 0; month <= 480; month++) {
      const year = month / 12;
      const simDate = new Date();
      simDate.setMonth(simDate.getMonth() + month);
      const isMortgagePaid = month >= live.currentMortgageMonths;
      const isCarPaid = month >= live.currentCarLoanMonths;
      let totalEduCost = 0;
      p.kids.forEach(child => {
        const childAge = getDecimalAge(child.birthYear, child.birthMonth, simDate);
        totalEduCost += getMonthlyEduCost(childAge, child.isPrivateSchool);
      });
      const monthlyExpenses = adjBasicExp + totalEduCost + (isMortgagePaid ? 0 : p.mortgage) + (isCarPaid ? 0 : p.carLoan);
      const monthlySavings = p.monthlyIncome - monthlyExpenses;
      const monthlyReturnRate = (adjAnnualReturn / 100) / 12;
      currentWealth = (currentWealth * (1 + monthlyReturnRate)) + monthlySavings;
      
      if (month % 12 === 0) {
        history.push({ 
          year, 
          age: Number((live.currentAge + year).toFixed(1)), 
          wealth: Math.round(currentWealth), 
          eduCost: Math.round(totalEduCost), 
          debtCost: Math.round((isMortgagePaid ? 0 : p.mortgage) + (isCarPaid ? 0 : p.carLoan)),
          monthlySavings: Math.round(monthlySavings)
        });
      }
      if (currentWealth >= fireTarget && yearsToFire === 0) { yearsToFire = year; }
    }
    return { history, fireTarget, yearsToFire };
  };

  const scenarios = useMemo(() => {
    const current = calculateForParams(profile, liveState, 1, 0);
    const aggressive = calculateForParams(profile, liveState, 0.85, 1.5); 
    const conservative = calculateForParams(profile, liveState, 1.15, -1.5); 
    const chartData = current.history.map((d, i) => ({
      age: d.age, current: d.wealth, eduCost: d.eduCost, debtCost: d.debtCost,
      aggressive: aggressive.history[i]?.wealth || 0,
      conservative: conservative.history[i]?.wealth || 0,
    }));
    return { chartData, current, aggressive, conservative };
  }, [profile, liveState, targetMonthlyBudget]);

  const activeData = scenarios[mode];

  const askAi = async () => {
    const ai = getAiClient();
    if (!ai) {
      setAiMessage("⚠️ 尚未偵測到 API Key。請在 Netlify 設定環境變數 API_KEY 後重新部署。");
      return;
    }
    setIsAiLoading(true);
    try {
      const prompt = `分析 FIRE 進度：現年 ${liveState.currentAge.toFixed(1)}，債務結束後現金流將自動轉入 ETF。請針對「加速路徑」給予建議，說明債務消失對資產滾動的具體影響。`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setAiMessage(response.text || "複利是世界第八大奇蹟，債務釋放則是引擎的增壓器。");
    } catch (e) {
      setAiMessage("AI 分析暫時不可用，請檢查連線。");
    } finally { setIsAiLoading(false); }
  };

  const fetchStockAdvice = async () => {
    const ai = getAiClient();
    if (!ai) return;
    setIsStockLoading(true);
    try {
      const prompt = `我將在房貸與車貸結束後，將原本月繳 $${profile.mortgage + profile.carLoan} 的現金流轉入投資。請建議適合大規模轉入的穩健台股 ETF 或標的。`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { tools: [{ googleSearch: {} }] } });
      setStockAdvice(response.text || "暫時無法獲取建議。");
    } catch (error) { setStockAdvice("搜尋標的失敗。"); } finally { setIsStockLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => askAi(), 2000);
    return () => clearTimeout(timer);
  }, [profile, mode, targetRetireAge, targetMonthlyBudget]);

  const updateChild = (idx: number, field: keyof ChildProfile, val: any) => {
    const newKids = [...profile.kids];
    newKids[idx] = { ...newKids[idx], [field]: val };
    setProfile({ ...profile, kids: newKids });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {!getApiKey() && (
        <div className="max-w-7xl mx-auto mb-6 bg-rose-500/10 border border-rose-500/50 p-4 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
          <AlertTriangle size={18} />
          <span>檢測到 API Key 缺失。請在 Netlify 設定 <strong>API_KEY</strong>。</span>
        </div>
      )}
      
      <nav className="max-w-7xl mx-auto mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="text-slate-900" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter">NEXUS <span className="text-emerald-400">FIRE</span></h1>
            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
              <RefreshCcw size={8} className="animate-spin-slow" /> Strategic Planner V9
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-slate-900/50 p-1 rounded-2xl border border-white/5 flex">
            <ModeToggle active={mode === 'conservative'} onClick={() => setMode('conservative')} icon={<ShieldAlert size={14}/>} label="保守" color="amber" />
            <ModeToggle active={mode === 'current'} onClick={() => setMode('current')} icon={<Activity size={14}/>} label="標準" color="emerald" />
            <ModeToggle active={mode === 'aggressive'} onClick={() => setMode('aggressive')} icon={<Rocket size={14}/>} label="積極" color="indigo" />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Cake size={14} className="text-purple-400" /> 生日與精確年齡
            </h2>
            <div className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <InputItem label="出生年份" value={profile.birthYear} onChange={(v) => setProfile({...profile, birthYear: v})} icon={<Calendar size={16}/>} />
                <InputItem label="出生月份" value={profile.birthMonth} onChange={(v) => setProfile({...profile, birthMonth: v})} icon={<Clock size={16}/>} />
              </div>
              <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">目前年齡推估</span>
                <span className="text-sm font-black text-purple-400">{liveState.currentAge.toFixed(2)} 歲</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-indigo-500/20 rounded-3xl p-6 backdrop-blur-md ring-1 ring-indigo-500/10">
            <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Compass size={14} /> FIRE 目標反推
            </h2>
            <div className="space-y-4 text-left">
              <InputItem label="退休理想月預算" value={targetMonthlyBudget} onChange={setTargetMonthlyBudget} icon={<DollarSign size={16}/>} hint={`所需總額約 $${(reversePlanning.assetsNeededForBudget/10000).toFixed(0)} 萬`} />
              <InputItem label="設定目標退休年齡" value={targetRetireAge} onChange={setTargetRetireAge} icon={<Clock size={16}/>} hint={`距離目標還有 ${(targetRetireAge - liveState.currentAge).toFixed(1)} 年`} />
              <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">準時退休缺口</span>
                  <span className="text-sm font-black text-indigo-400">$ {reversePlanning.savingsGap.toLocaleString()} /月</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-emerald-500/20 rounded-3xl p-6 backdrop-blur-md">
            <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <TrendingUp size={14} /> 核心收支與 ETF
            </h2>
            <div className="space-y-4 text-left">
              <InputItem label="預期年回報 %" value={profile.annualReturn} onChange={(v) => setProfile({...profile, annualReturn: v})} icon={<BarChart3 size={16}/>} />
              <InputItem 
                label="每月初始投入 ETF" 
                value={profile.monthlyEtfInvestment} 
                onChange={(v) => setProfile({...profile, monthlyEtfInvestment: v})} 
                icon={<PiggyBank size={16} className="text-indigo-400"/>} 
                hint={`基礎需 ${reversePlanning.etfYearsToTarget.toFixed(1)} 年`}
              />
              <InputItem label="月總收入 (不含息)" value={profile.monthlyIncome} onChange={(v) => setProfile({...profile, monthlyIncome: v})} icon={<DollarSign size={16}/>} />
              <InputItem label="目前資產" value={profile.currentAssets} onChange={(v) => setProfile({...profile, currentAssets: v, baseAssetDate: Date.now()})} icon={<Zap size={16}/>} hint={"今日推估值：$" + liveState.currentAssets.toLocaleString()} />
              <InputItem label="基礎月開銷" value={profile.basicLivingExpenses} onChange={(v) => setProfile({...profile, basicLivingExpenses: v})} icon={<Calendar size={16}/>} />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-blue-500/20 rounded-3xl p-6 backdrop-blur-md">
            <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Target size={14} /> 債務與現金流釋放
            </h2>
            <div className="space-y-6 text-left">
              <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 mb-2">
                <p className="text-[10px] text-blue-300/80 leading-relaxed italic">
                  💡 系統已設定：債務結束後，月繳金額將自動轉入 ETF 計算複利。
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase"><Home size={12}/> 房貸支出</div>
                <div className="grid grid-cols-2 gap-3">
                  <InputItem label="月繳金額" value={profile.mortgage} onChange={(v) => setProfile({...profile, mortgage: v})} />
                  <InputItem label="剩餘月數" value={profile.mortgageMonths} onChange={(v) => setProfile({...profile, mortgageMonths: v})} hint={`剩 ${liveState.currentMortgageMonths} 月`} />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase"><Car size={12}/> 車貸支出</div>
                <div className="grid grid-cols-2 gap-3">
                  <InputItem label="月繳金額" value={profile.carLoan} onChange={(v) => setProfile({...profile, carLoan: v})} />
                  <InputItem label="剩餘月數" value={profile.carLoanMonths} onChange={(v) => setProfile({...profile, carLoanMonths: v})} hint={`剩 ${liveState.currentCarLoanMonths} 月`} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-rose-500/20 rounded-3xl p-6 backdrop-blur-md">
            <h2 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Baby size={14} /> 子女教育週期
            </h2>
            <div className="space-y-6 text-left">
              {profile.kids.map((child, idx) => (
                <div key={idx} className="p-4 bg-slate-950/50 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">子女 {idx + 1}</span>
                    <button onClick={() => updateChild(idx, 'isPrivateSchool', !child.isPrivateSchool)} className={`text-[9px] px-2 py-1 rounded-full border transition-all ${child.isPrivateSchool ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' : 'border-slate-700 text-slate-500'}`}>{child.isPrivateSchool ? '私立' : '公立'}</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InputItem label="年份" value={child.birthYear} onChange={(v) => updateChild(idx, 'birthYear', v)} />
                    <InputItem label="月份" value={child.birthMonth} onChange={(v) => updateChild(idx, 'birthMonth', v)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6 text-left">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full -mr-20 -mt-20"></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=firev9&backgroundColor=0f172a`} className="w-10 h-10 rounded-full bg-slate-700 border border-white/10 shadow-lg" alt="Mentor" />
              <div className="flex flex-col">
                <h3 className="text-sm font-bold text-emerald-400 tracking-tight">AI Achievement Mentor</h3>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Accelerated Debt-to-Equity</span>
              </div>
            </div>
            <p className={`text-lg leading-relaxed relative z-10 font-medium ${isAiLoading ? 'opacity-50 animate-pulse' : ''}`}>
              「{aiMessage}」
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="達成歲數" value={`${(liveState.currentAge + activeData.yearsToFire).toFixed(1)} 歲`} subtext={`目標 ${targetRetireAge} 歲`} highlight={(liveState.currentAge + activeData.yearsToFire) <= targetRetireAge ? 'text-emerald-400' : 'text-rose-400'} />
            <StatCard 
              label="債務加速達標" 
              value={`${reversePlanning.accEtfYearsToTarget.toFixed(1)} 年`} 
              subtext={`較基礎縮短 ${(reversePlanning.etfYearsToTarget - reversePlanning.accEtfYearsToTarget).toFixed(1)} 年`} 
              icon={<FastForward size={14} className="text-blue-400" />} 
              highlight="text-blue-400"
            />
            <StatCard label="所需總額" value={`$${(reversePlanning.assetsNeededForBudget / 10000).toFixed(0)} 萬`} subtext={`月支 $${targetMonthlyBudget.toLocaleString()}`} icon={<PiggyBank size={14} />} />
            <StatCard label="儲蓄缺口" value={`$${reversePlanning.savingsGap.toLocaleString()}`} subtext="每月需額外投入" highlight={reversePlanning.savingsGap > 0 ? 'text-indigo-400' : 'text-emerald-400'} icon={<ArrowUpCircle size={14} />} />
          </div>

          <div className="bg-slate-900/60 border border-white/10 rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-300">長期資產複利曲線 (含債務轉入)</h3>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> 資產</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-500 rounded-full"></div> 支出</span>
              </div>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={scenarios.chartData}>
                  <defs>
                    <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="age" stroke="#475569" fontSize={11} axisLine={false} tickLine={false} dy={10} />
                  <YAxis yAxisId="left" stroke="#475569" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/10000).toFixed(0)}w`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }} />
                  <Legend verticalAlign="top" height={36}/>
                  <Area yAxisId="left" name="資產累積" type="monotone" dataKey="current" stroke="#10B981" strokeWidth={3} fill="url(#colorCurrent)" />
                  <Area yAxisId="right" name="各項支出" type="stepAfter" dataKey="eduCost" stroke="#f43f5e" strokeWidth={2} fillOpacity={0.05} />
                  <Line yAxisId="left" name="積極情境" type="monotone" dataKey="aggressive" stroke="#6366f1" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                  <ReferenceLine yAxisId="left" y={reversePlanning.assetsNeededForBudget} stroke="#6366f1" strokeDasharray="5 5" label={{ position: 'top', value: 'FIRE 目標', fill: '#6366f1', fontSize: 10 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-white/10 rounded-[2.5rem] p-8">
            <button 
              onClick={() => setShowDetailTable(!showDetailTable)} 
              className="w-full flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <Table size={20} className="text-emerald-400" />
                <div className="text-left">
                  <h3 className="text-sm font-bold text-slate-300">資產增長年度明細 (含月結餘與支出變化)</h3>
                  <p className="text-[11px] text-slate-500">查看債務結束與子女教育開銷對複利的影響</p>
                </div>
              </div>
              {showDetailTable ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500 group-hover:text-emerald-400 transition-colors" />}
            </button>
            
            {showDetailTable && (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-[11px] text-slate-400 border-collapse">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="py-3 font-bold uppercase text-slate-500">年齡</th>
                      <th className="py-3 font-bold uppercase text-slate-500 text-right">預估資產</th>
                      <th className="py-3 font-bold uppercase text-slate-500 text-right">該年平均月結餘</th>
                      <th className="py-3 font-bold uppercase text-slate-500 text-right text-rose-400/80">教育支出</th>
                      <th className="py-3 font-bold uppercase text-slate-500 text-right">房/車貸支出</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeData.history.filter((_, i) => i % 2 === 0).slice(0, 25).map((row, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 font-bold text-slate-300">{row.age} 歲</td>
                        <td className="py-3 text-right font-mono text-emerald-400">${row.wealth.toLocaleString()}</td>
                        <td className="py-3 text-right font-mono text-indigo-300">${row.monthlySavings.toLocaleString()}</td>
                        <td className="py-3 text-right font-mono text-rose-400">${row.eduCost.toLocaleString()}</td>
                        <td className="py-3 text-right font-mono text-blue-400">${row.debtCost.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-4 text-[10px] text-slate-500 text-center italic">顯示前 25 年資料。結餘已包含債務釋放與教育階段轉換之影響。</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900/60 border border-white/10 rounded-[2.5rem] p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2"><Briefcase size={16} className="text-blue-400" /> 加速與標的建議</h3>
                <p className="text-[11px] text-slate-500">當債務轉入投資時，投資組合的穩定度更為重要。</p>
              </div>
              <button onClick={fetchStockAdvice} disabled={isStockLoading || !getApiKey()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 px-6 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2">
                {isStockLoading ? <RefreshCcw size={14} className="animate-spin" /> : <Search size={14} />} 分析加速標的
              </button>
            </div>
            {stockAdvice && (
              <div className="bg-slate-950/50 border border-white/5 rounded-3xl p-6 whitespace-pre-line text-slate-300 text-sm leading-relaxed">
                {stockAdvice}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ModeToggle({ active, onClick, icon, label, color }: any) {
  const colors: any = {
    emerald: active ? 'bg-emerald-500 text-slate-900' : 'text-slate-500 hover:text-emerald-400',
    indigo: active ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-indigo-400',
    amber: active ? 'bg-amber-500 text-slate-900' : 'text-slate-500 hover:text-amber-400',
  };
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${colors[color]}`}>
      {icon} {label}
    </button>
  );
}

function InputItem({ label, value, onChange, icon, hint }: any) {
  return (
    <div className="space-y-1 text-left">
      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">{label}</label>
      <div className="relative group">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500">{icon}</div>}
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className={`w-full bg-slate-950/50 border border-white/5 rounded-xl py-3 ${icon ? 'pl-10' : 'pl-4'} pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all`} />
      </div>
      {hint && <p className="text-[9px] text-slate-500 mt-1 px-1 leading-tight">{hint}</p>}
    </div>
  );
}

function StatCard({ label, value, subtext, highlight, icon }: any) {
  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 text-left hover:bg-slate-900/60 transition-all ring-1 ring-white/5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase mb-2">{icon} {label}</div>
      <div className={`text-xl font-black mb-1 ${highlight || 'text-white'}`}>{value}</div>
      <div className="text-[9px] text-slate-400 font-medium">{subtext}</div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<NexusFIRE />);
}
