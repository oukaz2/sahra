import { useState, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ACCESS_PASSWORD = import.meta.env.VITE_ACCESS_PASSWORD ?? "sahra2026";

interface AuthContextType {
  unlocked: boolean;
  unlock: () => void;
}

const AuthContext = createContext<AuthContextType>({ unlocked: true, unlock: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(!ACCESS_PASSWORD || ACCESS_PASSWORD === "");
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const tryUnlock = () => {
    if (input === ACCESS_PASSWORD) {
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setInput("");
    }
  };

  if (unlocked) {
    return (
      <AuthContext.Provider value={{ unlocked, unlock: () => {} }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "hsl(222 28% 7%)" }}
    >
      <div
        className={`w-full max-w-sm mx-4 rounded-2xl p-8 space-y-6 ${shake ? "animate-shake" : ""}`}
        style={{ background: "hsl(222 28% 11%)", border: "1px solid hsl(220 15% 20%)" }}
      >
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-label="Sahra logo">
              <circle cx="16" cy="13" r="5" fill="hsl(38 88% 52%)" />
              <g stroke="hsl(38 88% 52%)" strokeWidth="1.8" strokeLinecap="round">
                <line x1="16" y1="4" x2="16" y2="2" />
                <line x1="16" y1="24" x2="16" y2="22" />
                <line x1="7" y1="13" x2="5" y2="13" />
                <line x1="27" y1="13" x2="25" y2="13" />
                <line x1="9.5" y1="6.5" x2="8.1" y2="5.1" />
                <line x1="23.9" y1="20.9" x2="22.5" y2="19.5" />
                <line x1="22.5" y1="6.5" x2="23.9" y2="5.1" />
                <line x1="8.1" y1="20.9" x2="9.5" y2="19.5" />
              </g>
              <path d="M6 26 Q16 20 26 26" stroke="hsl(38 88% 52%)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            </svg>
            <span className="text-xl font-bold" style={{ color: "hsl(38 88% 52%)" }}>Sahra</span>
          </div>
          <p className="text-sm" style={{ color: "hsl(220 15% 55%)" }}>Solar Billing Engine</p>
          <p className="text-xs" style={{ color: "hsl(220 15% 35%)" }}>Enter your access password to continue</p>
        </div>

        {/* Input */}
        <div className="space-y-3">
          <Input
            type="password"
            placeholder="Password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false); }}
            onKeyDown={e => e.key === "Enter" && tryUnlock()}
            autoFocus
            className={`text-center tracking-widest ${error ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            style={{ background: "hsl(222 28% 15%)", color: "hsl(220 15% 85%)" }}
            data-testid="input-password"
          />
          {error && (
            <p className="text-xs text-red-400 text-center">Incorrect password. Try again.</p>
          )}
          <Button
            className="w-full"
            onClick={tryUnlock}
            data-testid="button-unlock"
          >
            Access Dashboard
          </Button>
        </div>

        <p className="text-xs text-center" style={{ color: "hsl(220 15% 30%)" }}>
          sahra.energy · Solar Billing Engine
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.4s ease; }
      `}</style>
    </div>
  );
}
