'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Bot,
  User,
  X,
} from 'lucide-react';
import { VoiceCallResponse } from '../../lib/api/recovery';
import { fetchClient } from '../../lib/api/client';
import { Spinner } from '../ui/Spinner';

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callData: VoiceCallResponse | null;
  isLoading: boolean;
  onCallEnded: () => void;
}

type CallState = 'INITIATING' | 'CONNECTED' | 'ENDED' | 'FAILED';

interface TranscriptItem {
  id: string;
  sender: 'jea' | 'customer' | 'system';
  text: string;
  timestamp: string;
  outcome?: 'PROMISE' | 'ESCALATION';
}

export function VoiceCallModal({
  isOpen,
  onClose,
  callData,
  isLoading,
  onCallEnded,
}: VoiceCallModalProps) {
  const [isEnded, setIsEnded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [conversationItems, setConversationItems] = useState<TranscriptItem[]>([]);
  const [isSimulatingTool, setIsSimulatingTool] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const callState: CallState = isEnded
    ? 'ENDED'
    : callData?.elevenlabs_error
    ? 'FAILED'
    : isLoading || !callData
    ? 'INITIATING'
    : 'CONNECTED';

  useEffect(() => {
    if (!isOpen || !callData || isEnded) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, callData, isEnded]);

  const initialGreeting: TranscriptItem | null = callData
    ? {
        id: '1',
        sender: 'jea',
        text: `Hello, this is JEA from ${callData.dynamic_variables.company_name}. I'm calling regarding outstanding invoice ${callData.dynamic_variables.invoice_number} for ₹${Number(callData.dynamic_variables.invoice_amount).toLocaleString('en-IN')}, which was due on ${callData.dynamic_variables.due_date}.`,
        timestamp: 'Just now',
      }
    : null;

  const transcripts: TranscriptItem[] = initialGreeting
    ? [initialGreeting, ...conversationItems]
    : conversationItems;

  if (!isOpen) return null;

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    setIsEnded(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setConversationItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'system',
        text: 'Call concluded professionally.',
        timestamp: now,
      },
    ]);
    setTimeout(() => {
      onCallEnded();
    }, 1200);
  };

  // Interactive scenario testing triggers for Pair Programming & testing:
  const simulateCustomerResponse = async (scenario: 'promise' | 'uncertain' | 'dispute' | 'refusal' | 'claims_paid' | 'payment_link') => {
    if (!callData) return;
    setIsSimulatingTool(true);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const invNum = callData.dynamic_variables.invoice_number;

    try {
      if (scenario === 'promise') {
        const promiseDate = '2026-09-07';
        setConversationItems((prev) => [
          ...prev,
          { id: String(Date.now()), sender: 'customer', text: "I'll pay by Monday.", timestamp: now },
          { id: String(Date.now() + 1), sender: 'jea', text: `Just to confirm, you will complete the payment of ₹${Number(callData.dynamic_variables.invoice_amount).toLocaleString('en-IN')} by Monday (${promiseDate}), correct?`, timestamp: now },
          { id: String(Date.now() + 2), sender: 'customer', text: 'Yes, definitely.', timestamp: now },
        ]);

        // Trigger backend tool
        await fetchClient('/api/recovery/promise-to-pay', {
          method: 'POST',
          body: JSON.stringify({
            invoice_number: invNum,
            promised_date: promiseDate,
            customer_statement: 'Customer confirmed payment by Monday',
          }),
        });

        setConversationItems((prev) => [
          ...prev,
          {
            id: String(Date.now() + 3),
            sender: 'jea',
            text: `Thank you! I have recorded your commitment to pay by Monday, ${promiseDate}. We appreciate your cooperation. Have a great day!`,
            timestamp: now,
            outcome: 'PROMISE',
          },
        ]);
      } else if (scenario === 'uncertain') {
        setConversationItems((prev) => [
          ...prev,
          { id: String(Date.now()), sender: 'customer', text: "Maybe Monday, I'll try.", timestamp: now },
          { id: String(Date.now() + 1), sender: 'jea', text: "I understand. To ensure our system records a definite commitment and avoids further reminders, could you confirm an exact date by when the payment will be completed?", timestamp: now },
        ]);
      } else if (scenario === 'refusal') {
        setConversationItems((prev) => [
          ...prev,
          { id: String(Date.now()), sender: 'customer', text: "I won't pay this invoice.", timestamp: now },
        ]);

        // Trigger backend tool
        await fetchClient('/api/recovery/human-intervention', {
          method: 'POST',
          body: JSON.stringify({
            invoice_number: invNum,
            reason: 'PAYMENT_REFUSAL',
            customer_statement: 'Customer explicitly refused to pay',
          }),
        });

        setConversationItems((prev) => [
          ...prev,
          {
            id: String(Date.now() + 2),
            sender: 'jea',
            text: "I understand. I'll have a member of our team review this and assist you further. Thank you for your time.",
            timestamp: now,
            outcome: 'ESCALATION',
          },
        ]);
      } else if (scenario === 'dispute') {
        setConversationItems((prev) => [
          ...prev,
          { id: String(Date.now()), sender: 'customer', text: "The invoice amount is wrong, we never received these services.", timestamp: now },
        ]);

        await fetchClient('/api/recovery/human-intervention', {
          method: 'POST',
          body: JSON.stringify({
            invoice_number: invNum,
            reason: 'INVOICE_DISPUTE',
            customer_statement: 'Customer disputed invoice validity and amount',
          }),
        });

        setConversationItems((prev) => [
          ...prev,
          {
            id: String(Date.now() + 2),
            sender: 'jea',
            text: "I understand your concern regarding the invoice details. I have forwarded this dispute directly to our billing team for immediate review.",
            timestamp: now,
            outcome: 'ESCALATION',
          },
        ]);
      } else if (scenario === 'claims_paid') {
        setConversationItems((prev) => [
          ...prev,
          { id: String(Date.now()), sender: 'customer', text: "I already paid this yesterday.", timestamp: now },
        ]);

        await fetchClient('/api/recovery/human-intervention', {
          method: 'POST',
          body: JSON.stringify({
            invoice_number: invNum,
            reason: 'CUSTOMER_CLAIMS_PAID',
            customer_statement: 'Customer claims payment was already completed',
          }),
        });

        setConversationItems((prev) => [
          ...prev,
          {
            id: String(Date.now() + 2),
            sender: 'jea',
            text: "Thank you for letting me know. I have flagged this for our finance team to verify the payment receipt right away.",
            timestamp: now,
            outcome: 'ESCALATION',
          },
        ]);
      } else if (scenario === 'payment_link') {
        let paymentLink = callData.invoice.payment_link;
        try {
          const res = (await fetchClient(
            `/api/recovery/invoices/${callData.invoice.invoice_id}/payment-link`,
            { method: 'POST' }
          )) as { success: boolean; payment_link: string } | null;
          if (res?.payment_link) {
            paymentLink = res.payment_link;
            callData.invoice.payment_link = res.payment_link;
          }
        } catch (e) {
          console.error('Failed to ensure payment link in voice modal', e);
        }

        setConversationItems((prev) => [
          ...prev,
          { id: String(Date.now()), sender: 'customer', text: "Can you send me the payment link?", timestamp: now },
          {
            id: String(Date.now() + 1),
            sender: 'jea',
            text: paymentLink
              ? `I've sent the secure Razorpay payment link directly to your WhatsApp and email: ${paymentLink}. You can use it anytime to complete the payment.`
              : "The payment link has already been sent to you through WhatsApp and email. You can use that link to complete the payment securely.",
            timestamp: now,
          },
        ]);
      }
    } catch {
      setConversationItems((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'jea',
          text: "Sorry, I'm having trouble updating that right now. I'll have our team assist you.",
          timestamp: now,
        },
      ]);
    } finally {
      setIsSimulatingTool(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0f1117] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                <Bot className="w-5 h-5" />
              </div>
              {callState === 'CONNECTED' && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0f1117] animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-base">JEA — Voice Recovery Agent</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  ElevenLabs
                </span>
              </div>
              <p className="text-zinc-500 text-xs">
                {callState === 'INITIATING' && 'Dialing & connecting...'}
                {callState === 'CONNECTED' && `Active session · ${formatDuration(seconds)}`}
                {callState === 'ENDED' && 'Call ended'}
                {callState === 'FAILED' && 'Connection failed'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invoice Context Bar */}
        {callData && (
          <div className="px-6 py-2.5 bg-indigo-500/5 border-b border-indigo-500/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <span>Customer:</span>
              <strong className="text-white">{callData.dynamic_variables.customer_name}</strong>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span>Invoice:</span>
              <strong className="text-indigo-300">{callData.dynamic_variables.invoice_number}</strong>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span>Amount:</span>
              <strong className="text-emerald-400 font-bold">
                ₹{Number(callData.dynamic_variables.invoice_amount).toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span>Due Date:</span>
              <strong className="text-amber-400">{callData.dynamic_variables.due_date}</strong>
            </div>
          </div>
        )}

        {/* Voice Visualizer / Status Area */}
        <div className="p-6 text-center border-b border-white/5 bg-gradient-to-b from-transparent to-white/[0.01]">
          {isLoading || callState === 'INITIATING' ? (
            <div className="py-6 flex flex-col items-center">
              <div className="text-indigo-400 mb-3">
                <Spinner size="lg" />
              </div>
              <p className="text-white font-semibold text-sm">Initializing voice agent connection...</p>
              <p className="text-zinc-500 text-xs mt-1">Generating signed session credentials securely</p>
            </div>
          ) : callState === 'CONNECTED' ? (
            <div className="flex flex-col items-center">
              {/* Animated Waveform Visualizer */}
              <div className="flex items-center justify-center gap-1.5 h-12 mb-3">
                {[40, 70, 30, 90, 60, 100, 50, 80, 45, 85, 35].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-gradient-to-t from-indigo-500 to-purple-400 rounded-full animate-pulse"
                    style={{
                      height: `${h}%`,
                      animationDelay: `${i * 120}ms`,
                      animationDuration: '1.2s',
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-semibold">
                <Volume2 className="w-3.5 h-3.5" />
                Live Conversation · JEA is speaking & listening
              </div>
            </div>
          ) : (
            <div className="py-4">
              <p className="text-zinc-400 text-sm font-medium">Session concluded</p>
            </div>
          )}
        </div>

        {/* Conversation Transcript */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[220px]">
          {transcripts.map((t) => (
            <div
              key={t.id}
              className={`flex gap-3 ${
                t.sender === 'customer'
                  ? 'justify-end'
                  : t.sender === 'system'
                  ? 'justify-center'
                  : 'justify-start'
              }`}
            >
              {t.sender === 'jea' && (
                <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0">
                  JEA
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed ${
                  t.sender === 'customer'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : t.sender === 'system'
                    ? 'bg-white/5 border border-white/10 text-zinc-400 text-xs text-center'
                    : 'bg-white/5 border border-white/8 text-zinc-200 rounded-tl-none'
                }`}
              >
                <p>{t.text}</p>
                {t.outcome === 'PROMISE' && (
                  <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Promise to Pay recorded in database & LangGraph set to WAIT
                  </div>
                )}
                {t.outcome === 'ESCALATION' && (
                  <div className="mt-2.5 pt-2 border-t border-rose-500/20 flex items-center gap-1.5 text-xs text-rose-400 font-semibold">
                    <ShieldAlert className="w-4 h-4" />
                    Escalated to human review (Recovery status: NEEDS_HUMAN_INTERVENTION)
                  </div>
                )}
                <span className="block text-[10px] text-zinc-500 mt-1 text-right">{t.timestamp}</span>
              </div>

              {t.sender === 'customer' && (
                <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-purple-300 text-xs font-bold shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick Scenario Testing Actions (For testing recovery agent scenarios in browser) */}
        {callState === 'CONNECTED' && (
          <div className="p-4 bg-white/[0.01] border-t border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-500 text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                Customer Response Scenarios
              </span>
              {isSimulatingTool && <span className="text-indigo-400 text-xs animate-pulse">Processing tool call...</span>}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <button
                disabled={isSimulatingTool}
                onClick={() => simulateCustomerResponse('promise')}
                className="px-2.5 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium transition-all text-center"
              >
                Pay Monday
              </button>
              <button
                disabled={isSimulatingTool}
                onClick={() => simulateCustomerResponse('uncertain')}
                className="px-2.5 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-medium transition-all text-center"
              >
                Maybe Monday
              </button>
              <button
                disabled={isSimulatingTool}
                onClick={() => simulateCustomerResponse('refusal')}
                className="px-2.5 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium transition-all text-center"
              >
                Won&apos;t Pay
              </button>
              <button
                disabled={isSimulatingTool}
                onClick={() => simulateCustomerResponse('dispute')}
                className="px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-medium transition-all text-center"
              >
                Dispute
              </button>
              <button
                disabled={isSimulatingTool}
                onClick={() => simulateCustomerResponse('claims_paid')}
                className="px-2.5 py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-medium transition-all text-center"
              >
                Already Paid
              </button>
              <button
                disabled={isSimulatingTool}
                onClick={() => simulateCustomerResponse('payment_link')}
                className="px-2.5 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium transition-all text-center"
              >
                Payment Link?
              </button>
            </div>
          </div>
        )}

        {/* Call Controls Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/8 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-2xl border transition-all ${
                isMuted
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  : 'bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {callState === 'CONNECTED' ? (
              <button
                onClick={handleEndCall}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-[0_0_20px_rgba(225,29,72,0.4)] transition-all"
              >
                <PhoneOff className="w-4 h-4" />
                End Call
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition-all"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
