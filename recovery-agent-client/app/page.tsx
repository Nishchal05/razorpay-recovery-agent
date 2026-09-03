"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ArrowRight, 
  BrainCircuit, 
  MessageCircle, 
  CreditCard, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  PlayCircle,
  TrendingUp,
  Activity,
  UserCheck,
  Mail,
  Phone
} from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] text-zinc-50 overflow-hidden font-sans selection:bg-indigo-500/30">
      
      {/* Background gradients */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Minimal top nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">Recovery Agent</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/signin" className="text-zinc-400 hover:text-white text-sm font-medium transition-colors px-3 py-1.5">
            Sign In
          </Link>
          <Link href="/signup" className="text-white text-sm font-semibold px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 transition-all shadow-[0_0_12px_rgba(79,70,229,0.3)]">
            Sign Up
          </Link>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-20 px-4 md:px-6 z-10 flex flex-col items-center justify-center min-h-[90vh]">
        <motion.div 
          className="max-w-5xl mx-auto w-full text-center flex flex-col items-center"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={fadeIn} className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
            <BrainCircuit className="w-4 h-4" />
            Autonomous Receivables Agent
          </motion.div>
          
          <motion.h1 variants={fadeIn} className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
            Stop Chasing Payments.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Let AI Recover Them.</span>
          </motion.h1>
          
          <motion.p variants={fadeIn} className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Recovery Agent understands each customer's payment behavior and chooses the right way to follow up — WhatsApp, email, or voice.
          </motion.p>
          
          <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link href="/signup" className="inline-flex items-center justify-center px-8 py-4 text-base font-medium rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]">
              Start Recovering <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link href="/signin" className="inline-flex items-center justify-center px-8 py-4 text-base font-medium rounded-full bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white transition-all backdrop-blur-sm">
              <PlayCircle className="mr-2 w-5 h-5" /> Sign In
            </Link>
          </motion.div>

          {/* Hero Visual Workflow — Premium Redesign */}
          <motion.div
            variants={fadeIn}
            className="mt-24 w-full max-w-5xl mx-auto relative"
          >
            {/* Ambient glow behind the whole card */}
            <div className="absolute -inset-4 bg-gradient-to-b from-indigo-600/10 via-purple-600/5 to-emerald-600/10 blur-3xl rounded-3xl pointer-events-none" />

            <div className="relative rounded-3xl border border-white/10 bg-black/60 backdrop-blur-2xl shadow-[0_0_80px_rgba(79,70,229,0.12)] overflow-hidden">
              {/* Top color bar */}
              <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

              <div className="p-6 md:p-10">

                {/* ── Row 1: Trigger ── */}
                <div className="flex justify-center mb-8">
                  <div className="relative inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                    <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/10 pointer-events-none" />
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-amber-300 font-black text-xl tracking-tight">₹2,40,000</div>
                      <div className="text-amber-500/70 text-[11px] font-semibold uppercase tracking-widest">Overdue Invoice</div>
                    </div>
                  </div>
                </div>

                {/* ── Connector ── */}
                <div className="flex justify-center mb-8">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-px h-6 bg-gradient-to-b from-amber-500/50 to-indigo-500/50" />
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                    <div className="w-px h-6 bg-gradient-to-b from-indigo-500/50 to-indigo-500/20" />
                  </div>
                </div>

                {/* ── Row 2: AI Decision Card + Channels — side by side on desktop ── */}
                <div className="flex flex-col lg:flex-row gap-6 items-stretch mb-8">

                  {/* AI Context card */}
                  <div className="flex-1 relative rounded-2xl bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-500/30 p-6 shadow-[0_0_40px_rgba(99,102,241,0.15)] overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

                    {/* Header */}
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                        <BrainCircuit className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">AI Understands Context</div>
                        <div className="text-indigo-400/60 text-[10px] uppercase tracking-widest">Analyzing customer data</div>
                      </div>
                    </div>

                    {/* Insight rows */}
                    <div className="space-y-3 mb-5">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="text-zinc-300 text-sm">Customer prefers <span className="text-white font-semibold">WhatsApp</span></span>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="text-zinc-300 text-sm"><span className="text-white font-semibold">82%</span> response rate on WhatsApp</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="text-zinc-300 text-sm">Invoice is <span className="text-amber-400 font-semibold">4 days</span> overdue</span>
                      </div>
                    </div>

                    {/* Decision pill */}
                    <div className="pt-4 border-t border-indigo-500/20 flex items-center justify-between">
                      <span className="text-zinc-500 text-xs uppercase tracking-widest font-semibold">Decision</span>
                      <div className="flex items-center gap-2 bg-green-500/15 border border-green-500/30 px-4 py-1.5 rounded-full shadow-[0_0_12px_rgba(34,197,94,0.2)]">
                        <MessageCircle className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-green-400 font-bold text-sm">WhatsApp</span>
                      </div>
                    </div>
                  </div>

                  {/* Channel selector */}
                  <div className="flex flex-col justify-between gap-4 lg:w-52">
                    <div className="text-center">
                      <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-4">AI Selects Channel</div>
                    </div>

                    {/* WhatsApp — selected */}
                    <div className="relative flex items-center gap-4 p-4 rounded-2xl bg-green-500/10 border border-green-500/35 shadow-[0_0_25px_rgba(34,197,94,0.2)]">
                      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-green-500/10 to-transparent pointer-events-none" />
                      <div className="relative w-11 h-11 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.3)] shrink-0">
                        <MessageCircle className="w-5 h-5 text-green-400" />
                        <div className="absolute -inset-1.5 rounded-xl border border-green-500/20 animate-pulse" />
                      </div>
                      <div>
                        <div className="text-green-300 font-bold text-sm">WhatsApp</div>
                        <div className="text-green-500/60 text-[10px]">82% response rate</div>
                      </div>
                      <div className="ml-auto w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
                    </div>

                    {/* Email — muted */}
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/8 opacity-35">
                      <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5 text-zinc-500" />
                      </div>
                      <div>
                        <div className="text-zinc-400 font-semibold text-sm">Email</div>
                        <div className="text-zinc-600 text-[10px]">31% response rate</div>
                      </div>
                    </div>

                    {/* Voice — muted */}
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/8 opacity-35">
                      <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5 text-zinc-500" />
                      </div>
                      <div>
                        <div className="text-zinc-400 font-semibold text-sm">Voice</div>
                        <div className="text-zinc-600 text-[10px]">54% response rate</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Connector ── */}
                <div className="flex justify-center mb-8">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-px h-6 bg-gradient-to-b from-green-500/50 to-blue-500/30" />
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    <div className="w-px h-6 bg-gradient-to-b from-blue-500/30 to-emerald-500/20" />
                  </div>
                </div>

                {/* ── Row 3: Chat + Outcome — side by side on desktop ── */}
                <div className="flex flex-col lg:flex-row gap-6 items-stretch">

                  {/* Chat mockup */}
                  <div className="flex-1 rounded-2xl bg-[#0f1623] border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.08)] overflow-hidden">
                    {/* Chat header */}
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 bg-white/[0.03]">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                        <MessageCircle className="w-4 h-4 text-green-400" />
                      </div>
                      <div>
                        <div className="text-white font-semibold text-sm">WhatsApp</div>
                        <div className="text-green-400 text-[11px]">● Personalized follow-up sent</div>
                      </div>
                    </div>
                    {/* Messages */}
                    <div className="p-5 space-y-4">
                      <div className="flex justify-start">
                        <div className="bg-indigo-600 text-white text-[13px] leading-relaxed py-3 px-4 rounded-2xl rounded-tl-sm max-w-[80%] shadow-[0_2px_12px_rgba(99,102,241,0.3)]">
                          Hi Rahul, your invoice #INV-1024 of ₹2,40,000 is 4 days overdue. You had promised payment last Friday — can you share an update?
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-[#1e293b] border border-white/8 text-zinc-200 text-[13px] py-3 px-4 rounded-2xl rounded-tr-sm max-w-[70%]">
                          Sorry for the delay. Can pay this Friday.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Outcome stack */}
                  <div className="flex flex-col gap-4 lg:w-52 justify-center">
                    {/* Promise badge */}
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-blue-300 font-bold text-sm">Promise to Pay</div>
                        <div className="text-blue-500/60 text-[11px] uppercase tracking-wide">Friday</div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center">
                      <div className="w-px h-6 bg-gradient-to-b from-blue-500/40 to-emerald-500/40" />
                    </div>

                    {/* Payment received */}
                    <div className="relative flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-emerald-300 font-black text-base">₹80,000</div>
                        <div className="text-emerald-500/60 text-[10px] uppercase tracking-wide">Payment Received</div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Bottom color bar */}
              <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* --- METRICS SECTION --- */}
      <section className="py-16 border-y border-white/5 bg-white/[0.02]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-around items-center gap-10 text-center">
            <MetricCard value="₹12.4L" label="Total Overdue Processed" icon={<Activity className="w-5 h-5 text-zinc-500" />} />
            <div className="w-px h-16 bg-white/10 hidden md:block" />
            <MetricCard value="₹7.8L" label="Recovered by AI" icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} />
            <div className="w-px h-16 bg-white/10 hidden md:block" />
            <MetricCard value="63%" label="Automated Recovery Rate" icon={<CheckCircle2 className="w-5 h-5 text-indigo-400" />} />
          </div>
          <p className="text-center text-zinc-500 text-sm mt-10 uppercase tracking-widest font-semibold">Every recovered rupee is measurable.</p>
        </div>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section id="product" className="py-24 relative z-10">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">Autonomous, not just automated.</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">Recovery Agent goes beyond scheduled emails. It reads context, understands delays, and drives outcomes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureCard 
              icon={<BrainCircuit />}
              title="AI That Knows When to Chase"
              description="Understands payment history, customer responses, and previous promises to choose the right follow-up strategy automatically."
            />
            <FeatureCard 
              icon={<MessageCircle />}
              title="Follow Up Where Customers Respond"
              description="Reach customers directly through WhatsApp and other preferred channels without manually tracking every single conversation."
            />
            <FeatureCard 
              icon={<CreditCard />}
              title="Turn a Reminder Into a Payment"
              description="Generate unique Razorpay payment links on the fly and place them directly inside the recovery conversation flow."
            />
            <FeatureCard 
              icon={<ShieldAlert />}
              title="AI Knows When to Stop"
              description="Disputes, repeated broken promises, and complex risky cases are detected and automatically routed to a human."
            />
          </div>
        </div>
      </section>

      {/* --- THE AGENT THINKS (AUDIT TRAIL) --- */}
      <section className="py-28 relative z-10 overflow-hidden">
        {/* Section background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent pointer-events-none" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-600/6 blur-[120px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-4 md:px-6 max-w-6xl relative">

          {/* Section label */}
          <div className="flex justify-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/8 text-indigo-400 text-xs font-semibold uppercase tracking-widest">
              <BrainCircuit className="w-3.5 h-3.5" /> Full Reasoning Transparency
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Left: copy */}
            <div>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
                Not Just Automation.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Context-Aware Recovery.</span>
              </h2>
              <p className="text-zinc-400 text-lg mb-10 leading-relaxed">
                Every action the AI takes is logged, justified, and visible. It doesn't blindly send messages — it reasons about the best approach for every specific invoice and every specific customer.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/6 hover:border-indigo-500/20 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold mb-1">Tracks Promise-to-Pay dates</div>
                    <div className="text-zinc-500 text-sm">Automatically follows up when a customer's promised date expires.</div>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/6 hover:border-indigo-500/20 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold mb-1">Halts outreach on complaints</div>
                    <div className="text-zinc-500 text-sm">NLP detects disputes in real time and pauses all automation instantly.</div>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/6 hover:border-indigo-500/20 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-white font-semibold mb-1">Full audit trail</div>
                    <div className="text-zinc-500 text-sm">Every decision is logged with timestamp and reasoning for finance teams.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Audit Trail Terminal */}
            <div className="relative">
              {/* Glow behind card */}
              <div className="absolute -inset-6 bg-indigo-600/8 blur-3xl rounded-3xl pointer-events-none" />

              <div className="relative rounded-2xl border border-white/10 bg-[#080c14] shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-hidden">
                {/* Top gradient bar */}
                <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />

                {/* Terminal chrome */}
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="flex-1 text-center text-zinc-600 text-xs font-mono">recovery-agent · reasoning log</div>
                </div>

                {/* Invoice header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
                  <div className="font-mono">
                    <div className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Invoice</div>
                    <div className="text-white font-bold text-base tracking-wide">#INV-1024</div>
                  </div>
                  <div className="font-mono text-right">
                    <div className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Status</div>
                    <div className="text-amber-400 font-bold">₹80,000 OVERDUE</div>
                  </div>
                </div>

                {/* Log entries */}
                <div className="p-6 space-y-0 font-mono text-[13px]">
                  <AuditLog time="10:02" text="Invoice detected as overdue" />
                  <AuditLog time="10:03" text="Retrieved previous customer conversations" />
                  <AuditLog time="10:03" text="Customer previously promised payment on Friday" highlight />
                  <AuditLog time="10:04" text="Promise date has expired" />
                  <AuditLog time="10:04" text='AI classified situation as &quot;Payment Delay&quot;' />
                  <AuditLog time="10:05" text='Selected strategy: &quot;Promise Follow-up&quot;' active />
                  <AuditLog time="10:05" text="WhatsApp reminder sent with Razorpay payment link" />
                </div>

                {/* Footer status */}
                <div className="px-6 pb-5 pt-1">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.8)] animate-pulse" />
                    <span className="text-emerald-400 font-mono text-xs">Agent running · next check in 24h</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section id="how-it-works" className="py-24 relative z-10">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">Four steps to automated cash flow.</h2>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-8 left-10 right-10 h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-indigo-500/0 hidden md:block" />
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <Step number="01" title="Connect Business" desc="Add your business and connect your communication channels." />
              <Step number="02" title="Add Invoices" desc="Import your customers and create invoices in seconds." />
              <Step number="03" title="AI Takes Over" desc="The agent analyzes context and chooses the right follow-up." />
              <Step number="04" title="Get Paid" desc="Customers receive links and reminders until resolved." />
            </div>
          </div>
        </div>
      </section>

      {/* --- SAFETY / TRUST SECTION --- */}
      <section className="py-24 bg-black relative z-10 border-t border-white/5">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">AI That Knows When <span className="text-rose-400">NOT</span> to Act</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">Controlled by strict business rules to protect your customer relationships.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TrustCard 
              title="3 Reminder Maximum"
              description="Automation never keeps chasing indefinitely. Hard caps prevent spamming your clients."
            />
            <TrustCard 
              title="Dispute Detected"
              description="Invoice disputes are immediately detected by NLP and routed to a human agent."
              alert
            />
            <TrustCard 
              title="Promise Broken"
              description="Repeated failed promises trigger manual escalation instead of endless automated reminders."
            />
          </div>
        </div>
      </section>

      {/* --- BOTTOM CTA --- */}
      <section className="py-32 relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-indigo-600/10 blur-[100px] pointer-events-none" />
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-8">Stop chasing invoices.</h2>
          <Link href="/signup" className="inline-flex items-center justify-center px-10 py-5 text-lg font-medium rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-[0_0_30px_rgba(79,70,229,0.4)] hover:shadow-[0_0_40px_rgba(79,70,229,0.6)]">
            Start Recovering Now <ArrowRight className="ml-2 w-6 h-6" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 text-center text-zinc-500 text-sm">
        <div className="container mx-auto">
          &copy; {new Date().getFullYear()} Recovery Agent. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

// --- SUBCOMPONENTS ---

function WorkflowNode({ title, icon, highlight = false }: { title: string, icon: React.ReactNode, highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-3 p-4 rounded-xl ${highlight ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-white/5 border border-white/5'} backdrop-blur-md w-full md:w-auto`}>
      <div className="p-3 rounded-full bg-black/50 shadow-inner border border-white/5">
        {icon}
      </div>
      <span className={`text-xs font-semibold uppercase tracking-wider text-center ${highlight ? 'text-emerald-400' : 'text-zinc-300'}`}>{title}</span>
    </div>
  );
}

function WorkflowArrow() {
  return (
    <div className="hidden md:flex items-center text-zinc-600">
      <ArrowRight className="w-5 h-5" />
    </div>
  );
}

function MetricCard({ value, label, icon }: { value: string, label: string, icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10">{icon}</div>
      <div className="text-4xl md:text-5xl font-extrabold text-white mb-2">{value}</div>
      <div className="text-zinc-400 font-medium text-sm tracking-wide uppercase">{label}</div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/30 hover:bg-white/[0.07] transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-white">{title}</h3>
      <p className="text-zinc-400 leading-relaxed font-light">
        {description}
      </p>
    </motion.div>
  );
}

function AuditLog({ time, text, highlight = false, active = false }: { time: string, text: string, highlight?: boolean, active?: boolean }) {
  return (
    <div className={`flex items-start gap-4 py-3 border-b border-white/[0.04] last:border-0 group ${active ? 'bg-indigo-500/5 -mx-6 px-6 rounded-lg' : ''}`}>
      {/* Timeline dot */}
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div className={`w-2 h-2 rounded-full mt-[3px] ${
          active   ? 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.9)]' :
          highlight ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]' :
                     'bg-zinc-700'
        }`} />
      </div>
      {/* Timestamp */}
      <div className="text-zinc-600 text-[11px] pt-0.5 w-12 shrink-0">{time}</div>
      {/* Text */}
      <div className={`text-[13px] leading-relaxed ${
        active    ? 'text-white font-semibold' :
        highlight ? 'text-amber-300' :
                   'text-zinc-400'
      }`}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </div>
  );
}

function Step({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="flex flex-col relative group pt-8 md:pt-0">
      <div className="w-16 h-16 rounded-2xl bg-black border border-zinc-800 flex items-center justify-center text-xl font-black text-zinc-500 mb-6 group-hover:border-indigo-500 group-hover:text-indigo-400 transition-colors mx-auto md:mx-0 z-10 relative shadow-[0_0_15px_rgba(0,0,0,0.5)]">
        {number}
      </div>
      <h4 className="font-bold text-white mb-3 text-center md:text-left text-lg">{title}</h4>
      <p className="text-sm text-zinc-400 text-center md:text-left leading-relaxed">{desc}</p>
    </div>
  );
}

function TrustCard({ title, description, alert = false }: { title: string, description: string, alert?: boolean }) {
  return (
    <div className={`p-8 rounded-2xl border ${alert ? 'bg-rose-950/10 border-rose-900/30' : 'bg-zinc-900/40 border-zinc-800/80'} flex flex-col`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-6 ${alert ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-800 text-zinc-400'}`}>
        <ShieldAlert className="w-5 h-5" />
      </div>
      <h4 className="font-bold text-white mb-3 text-lg">{title}</h4>
      <p className="text-zinc-400 leading-relaxed text-sm">
        {description}
      </p>
    </div>
  );
}
