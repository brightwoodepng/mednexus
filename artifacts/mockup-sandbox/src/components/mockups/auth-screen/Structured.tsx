import React from "react";
import { Stethoscope, Sun, ChevronRight, User, Shield, MessageCircle } from "lucide-react";

export function Structured() {
  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 font-sans flex flex-col relative selection:bg-teal-500/30">
      {/* Theme Toggle */}
      <button className="absolute top-6 right-6 p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-700/50">
        <Sun className="w-5 h-5" />
      </button>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto">
        
        {/* Header Zone (Teal to Dark) */}
        <div className="w-full flex flex-col items-center mb-8 relative">
          <div className="absolute inset-0 -top-24 bg-gradient-to-b from-teal-500/20 to-transparent blur-3xl rounded-full opacity-50 pointer-events-none" />
          
          <div className="w-20 h-20 bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20 mb-6 relative z-10">
            <Stethoscope className="w-10 h-10 text-white" strokeWidth={2} />
          </div>
          
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3 relative z-10">
            Med<span className="text-teal-400">Nexus</span>
          </h1>
          <p className="text-zinc-400 text-center text-sm font-medium max-w-[280px] leading-relaxed relative z-10">
            Premium clinical Q-Bank for medical learners.
          </p>
        </div>

        {/* Card Zone */}
        <div className="w-full bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-zinc-200">
          
          {/* Primary Action Area */}
          <div className="p-8 pb-6">
            <button className="w-full group relative flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-600 text-white py-4 px-6 rounded-2xl font-semibold text-lg transition-all duration-200 shadow-md shadow-teal-500/25 hover:shadow-lg hover:shadow-teal-500/40 hover:-translate-y-0.5 active:translate-y-0">
              <User className="w-5 h-5" />
              <span>Student Login / Register</span>
              <ChevronRight className="w-5 h-5 absolute right-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center px-8">
            <div className="flex-1 h-px bg-zinc-100"></div>
            <span className="px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Other Options</span>
            <div className="flex-1 h-px bg-zinc-100"></div>
          </div>

          {/* Secondary Actions Area */}
          <div className="p-4 pt-4 pb-6 flex flex-col gap-1">
            <button className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-zinc-50 text-zinc-600 transition-colors group">
              <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center group-hover:bg-zinc-200 transition-colors">
                <User className="w-4 h-4 text-zinc-500" />
              </div>
              <span className="font-medium flex-1 text-left">Continue as Guest</span>
              <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
            </button>
            
            <button className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-zinc-50 text-zinc-500 transition-colors group">
              <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center group-hover:bg-zinc-200 transition-colors">
                <Shield className="w-4 h-4 text-zinc-400" />
              </div>
              <span className="font-medium flex-1 text-left text-sm">Admin Access</span>
              <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full py-8 flex flex-col items-center justify-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
          Created by Britechinc
        </p>
        <button className="flex items-center gap-1.5 text-zinc-400 hover:text-teal-400 text-xs transition-colors">
          <MessageCircle className="w-3.5 h-3.5" />
          <span>WhatsApp Support</span>
        </button>
      </div>
    </div>
  );
}
