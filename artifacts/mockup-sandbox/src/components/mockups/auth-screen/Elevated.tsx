import React from 'react';
import { Stethoscope, User, Moon, UserRound, Shield } from 'lucide-react';

export function Elevated() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative font-sans text-zinc-100 selection:bg-teal-500/30">
      {/* Theme Button */}
      <button className="absolute top-6 right-6 p-2.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shadow-sm ring-1 ring-zinc-800">
        <Moon size={20} />
      </button>

      {/* Main Card */}
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-zinc-800/50 flex flex-col">
        
        {/* Header Band */}
        <div className="bg-gradient-to-br from-teal-600 to-teal-800 p-8 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="absolute -right-8 -top-8 text-teal-400/20">
            <Stethoscope size={140} strokeWidth={1.5} />
          </div>
          
          <div className="relative z-10 bg-zinc-950/20 p-3.5 rounded-2xl mb-5 backdrop-blur-sm ring-1 ring-white/10 shadow-inner">
            <Stethoscope className="text-teal-50" size={36} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2 relative z-10">MedNexus</h1>
          <p className="text-teal-50/80 text-sm font-medium relative z-10 max-w-[260px]">
            Premium clinical Q-Bank for medical learners.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-8 flex flex-col gap-5">
          <button className="group relative flex items-center justify-center gap-3 w-full bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold py-4 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(20,184,166,0.15)] hover:shadow-[0_0_25px_rgba(20,184,166,0.3)] active:scale-[0.98]">
            <User size={22} strokeWidth={2.5} />
            <span>Student Login / Register</span>
          </button>

          <div className="flex flex-col gap-3 mt-2">
            <button className="flex items-center justify-center w-full bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium py-3.5 px-5 rounded-xl transition-all border border-zinc-700/50 active:scale-[0.98]">
              <span className="flex items-center gap-3">
                <UserRound size={18} className="text-zinc-400" />
                Continue as Guest
              </span>
            </button>

            <button className="flex items-center justify-center w-full bg-transparent hover:bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 font-medium py-3 px-5 rounded-xl transition-all active:scale-[0.98]">
              <span className="flex items-center gap-3">
                <Shield size={18} className="text-zinc-500" />
                Admin Access
              </span>
            </button>
          </div>
        </div>
        
        {/* Footer attached to card */}
        <div className="bg-zinc-950/40 p-5 text-center border-t border-zinc-800/60">
          <p className="text-xs text-zinc-500 mb-1.5">
            Created by <span className="font-medium text-zinc-400">Britechinc</span>
          </p>
          <p className="text-xs text-zinc-600">
            WhatsApp Support: <a href="#" className="hover:text-teal-400 transition-colors">+1 (555) 123-4567</a>
          </p>
        </div>
      </div>
    </div>
  );
}
