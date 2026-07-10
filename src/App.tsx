import React, { useState, useEffect } from "react";
import { Sparkles, Trash2, Copy, Check, Download, RefreshCw, FileText, Terminal, Code, Info, History } from "lucide-react";
import { OptimizationResult, OptimizationMode, HistoryItem } from "./types";
import { PRESET_EXAMPLES } from "./presets";

export default function App() {
  const [prompt, setPrompt] = useState<string>("");
  const [mode, setMode] = useState<OptimizationMode>("balanced");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  // Load history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("prompt_pruner_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(parsed);
        if (parsed.length > 0) {
          setResult(parsed[0].result);
          setPrompt(parsed[0].result.originalPrompt);
          setMode(parsed[0].mode);
          setActiveHistoryId(parsed[0].id);
        }
      } else {
        // Load first preset as default starter
        const firstPreset = PRESET_EXAMPLES[0];
        setPrompt(firstPreset.prompt);
        setMode(firstPreset.mode);
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }, []);

  // Save history helper
  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("prompt_pruner_history", JSON.stringify(newHistory));
    } catch (e) {
      console.error("Failed to save history:", e);
    }
  };

  const handleOptimize = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) {
      setError("Please enter or select a prompt to optimize.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${response.status} ${response.statusText}`);
      }

      const data: OptimizationResult = await response.json();
      setResult(data);

      // Add to history
      const timestamp = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      const newItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp,
        mode,
        result: data,
      };

      const updatedHistory = [newItem, ...history.slice(0, 49)]; // limit to 50 items
      saveHistory(updatedHistory);
      setActiveHistoryId(newItem.id);
    } catch (err: any) {
      console.error("Optimization failed:", err);
      setError(err.message || "Something went wrong while connecting to the optimization backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setResult(item.result);
    setPrompt(item.result.originalPrompt);
    setMode(item.mode);
    setActiveHistoryId(item.id);
    setError(null);
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter((h) => h.id !== id);
    saveHistory(updated);
    if (activeHistoryId === id) {
      if (updated.length > 0) {
        handleSelectHistory(updated[0]);
      } else {
        setResult(null);
        setActiveHistoryId(null);
      }
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your entire optimization history?")) {
      saveHistory([]);
      setResult(null);
      setActiveHistoryId(null);
    }
  };

  const triggerCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const loadPreset = (presetPrompt: string, presetMode: OptimizationMode) => {
    setPrompt(presetPrompt);
    setMode(presetMode);
    setError(null);
  };

  const exportAsFile = (format: "json" | "md" | "cli") => {
    if (!result) return;
    let fileContent = "";
    let fileName = "";
    let mimeType = "text/plain";

    if (format === "json") {
      fileContent = JSON.stringify(result, null, 2);
      fileName = `prompt-optimization-${Date.now()}.json`;
      mimeType = "application/json";
    } else if (format === "md") {
      fileContent = `# Prompt Optimization Card
      
## Original Prompt
\`\`\`text
${result.originalPrompt}
\`\`\`

## Optimized Prompt
\`\`\`text
${result.optimizedPrompt}
\`\`\`

## Optimization Report
- **Token Reduction**: -${result.estimatedTokenReduction}%
- **Quality Score**: ${result.qualityScore}/100
- **Optimization Mode**: ${mode.toUpperCase()}
- **Reason**: ${result.reason}

### Pruned Items
${result.removed.map((r) => `- [x] ${r}`).join("\n")}

### Simplified Items
${result.simplified.map((s) => `- ${s}`).join("\n")}

### Preserved Core Elements
${result.preserved.map((p) => `- **${p}**`).join("\n")}
`;
      fileName = `optimized-prompt-${Date.now()}.md`;
      mimeType = "text/markdown";
    } else if (format === "cli") {
      // Create a copyable curl command representation or simple instructions
      fileContent = `# To run using curl against Gemini API:
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${GEMINI_API_KEY}" \\
-H "Content-Type: application/json" \\
-d '{
  "contents": [{
    "parts":[{"text": ${JSON.stringify(result.optimizedPrompt)}}]
  }]
}'`;
      fileName = `gemini-curl-request-${Date.now()}.sh`;
      mimeType = "application/x-sh";
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans border-4 md:border-8 border-[#141414] flex flex-col overflow-x-hidden selection:bg-[#141414] selection:text-[#E4E3E0]">
      
      {/* Header Bar */}
      <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-[#141414] bg-[#E4E3E0] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#141414] flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rotate-45"></div>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tighter uppercase font-display">PromptPruner v1.1.2</h1>
            <p className="text-[9px] font-mono tracking-widest uppercase opacity-75 hidden sm:block">Token reduction and intent preservation console</p>
          </div>
        </div>
        
        <div className="flex gap-4 md:gap-8 items-center">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-mono opacity-50 uppercase">Optimization Engine</p>
            <p className="text-xs font-mono font-bold">GEMINI-3.5-FLASH-STABLE</p>
          </div>
          <div className="h-8 w-[1px] bg-[#141414] opacity-20 hidden sm:block"></div>
          <button 
            onClick={() => handleOptimize()}
            disabled={isLoading || !prompt.trim()}
            className="bg-[#141414] text-[#E4E3E0] hover:bg-[#2b2a29] disabled:bg-gray-400 disabled:cursor-not-allowed px-4 md:px-6 py-2 text-xs font-bold uppercase tracking-widest transition-colors border border-[#141414]"
          >
            {isLoading ? "Pruning..." : "Optimize"}
          </button>
        </div>
      </header>

      {/* Main Workspace Split */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden border-b border-[#141414]">
        
        {/* Left Side: Inputs, Controls, Presets */}
        <section className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-[#141414] bg-white/20">
          
          {/* Section Sub-header */}
          <div className="h-10 flex items-center justify-between px-4 bg-[#D1D0CC] border-b border-[#141414] shrink-0">
            <span className="text-[11px] font-serif italic">01. Input_Buffer & Mode_Config</span>
            <div className="flex gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span className="w-2 h-2 rounded-full bg-amber-600"></span>
            </div>
          </div>

          <div className="p-4 md:p-6 flex-1 flex flex-col gap-4">
            {/* Quick presets row */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#141414]/60 block mb-2 font-bold">Load Sample Preset:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PRESET_EXAMPLES.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => loadPreset(preset.prompt, preset.mode)}
                    className="p-2.5 text-left bg-white/80 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all duration-200 text-xs flex flex-col justify-between h-20 group"
                  >
                    <span className="font-bold tracking-tight block truncate w-full group-hover:text-white">{preset.title}</span>
                    <span className="text-[10px] opacity-60 font-mono mt-1 group-hover:text-indigo-200">
                      {preset.category} • {preset.mode}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode selection radio group */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#141414]/60 block mb-2 font-bold">Select Pruning Strategy:</span>
              <div className="grid grid-cols-3 gap-2">
                {(["conservative", "balanced", "aggressive"] as OptimizationMode[]).map((m) => (
                  <label
                    key={m}
                    className={`cursor-pointer border-2 p-2 flex flex-col justify-between transition-all duration-200 ${
                      mode === m
                        ? "bg-[#141414] text-[#E4E3E0] border-[#141414]"
                        : "bg-white/60 border-slate-300 hover:border-[#141414] text-[#141414]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider">{m}</span>
                      <input
                        type="radio"
                        name="mode"
                        value={m}
                        checked={mode === m}
                        onChange={() => {
                          setMode(m);
                          setError(null);
                        }}
                        className="sr-only"
                      />
                      <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                        mode === m ? "border-white bg-[#E4E3E0]" : "border-[#141414]"
                      }`}>
                        {mode === m && <div className="w-1.5 h-1.5 rounded-full bg-[#141414]" />}
                      </div>
                    </div>
                    <span className="text-[9px] opacity-70 mt-1 leading-tight">
                      {m === "conservative" && "Retains details & guidelines."}
                      {m === "balanced" && "Removes polite filler & wordiness."}
                      {m === "aggressive" && "Core instructions only."}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Input prompt text area */}
            <div className="flex-1 flex flex-col min-h-[220px]">
              <label htmlFor="prompt-input" className="text-[10px] font-mono uppercase tracking-widest text-[#141414]/60 mb-1.5 font-bold flex justify-between items-center">
                <span>Enter raw prompt template:</span>
                <span className="font-mono text-[9px] lowercase opacity-50">{prompt.length} chars | {prompt.split(/\s+/).filter(Boolean).length} words</span>
              </label>
              <div className="relative flex-1 flex flex-col">
                <textarea
                  id="prompt-input"
                  className="w-full flex-1 p-4 border-2 border-[#141414] bg-white font-mono text-xs md:text-sm leading-relaxed resize-none focus:outline-none focus:ring-0 focus:border-[#141414] placeholder:text-slate-400"
                  placeholder="Paste your verbose or unoptimized prompt here... e.g. 'I was hoping you could please tell me the exact steps to...'"
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setError(null);
                  }}
                />
                {prompt && (
                  <button
                    onClick={() => setPrompt("")}
                    className="absolute right-3 top-3 text-[10px] uppercase font-bold tracking-wider font-mono text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div className="bg-rose-50 border border-rose-600 text-rose-900 p-3 text-xs font-mono flex items-start gap-2">
                <span className="font-bold text-rose-600 shrink-0">[ERROR]</span>
                <span>{error}</span>
              </div>
            )}

            {/* Action Row */}
            <div className="flex gap-2">
              <button
                onClick={() => handleOptimize()}
                disabled={isLoading || !prompt.trim()}
                className="flex-1 bg-[#141414] text-[#E4E3E0] hover:bg-[#2b2a29] disabled:bg-gray-400 disabled:cursor-not-allowed font-mono text-xs font-bold uppercase tracking-widest py-3 border border-[#141414] transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    Pruning and compiling prompt...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Run Pruner Engine
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Right Side: Optimized Output / Comparator */}
        <section className="w-full lg:w-1/2 flex flex-col bg-white/10">
          
          <div className="h-10 flex items-center justify-between px-4 bg-[#D1D0CC] border-b border-[#141414] shrink-0">
            <span className="text-[11px] font-serif italic">02. Optimized_Output_Console</span>
            {result && (
              <span className="text-[10px] font-mono uppercase bg-[#141414] text-[#E4E3E0] px-2 py-0.5 font-semibold">
                Success
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col">
            {result ? (
              <div className="flex-1 flex flex-col bg-[#141414] text-[#E4E3E0]">
                {/* Output Controls Bar */}
                <div className="px-4 py-2 bg-[#232321] border-b border-[#141414] flex items-center justify-between text-xs font-mono shrink-0">
                  <span className="opacity-60 text-[10px] uppercase">Tokenized Prompt Sandbox</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerCopy(result.optimizedPrompt, "output")}
                      className="px-2 py-1 bg-white/10 hover:bg-white/20 transition-colors text-white font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 border border-white/10"
                    >
                      {copiedStates["output"] ? (
                        <>
                          <Check size={11} className="text-green-400" />
                          <span className="text-green-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Optimized Text Area */}
                <div className="flex-1 p-6 font-mono text-sm leading-relaxed overflow-y-auto whitespace-pre-wrap select-text selection:bg-[#E4E3E0] selection:text-[#141414]">
                  {result.optimizedPrompt}
                </div>

                {/* Output Stats Overlay */}
                <div className="p-4 bg-[#1e1e1d] border-t border-[#141414] flex items-center justify-between text-xs font-mono shrink-0">
                  <div className="flex gap-4">
                    <div>
                      <span className="opacity-40 uppercase text-[9px] block">Length</span>
                      <span className="font-bold">{result.optimizedPrompt.length} chars</span>
                    </div>
                    <div>
                      <span className="opacity-40 uppercase text-[9px] block">Words</span>
                      <span className="font-bold">{result.optimizedPrompt.split(/\s+/).filter(Boolean).length} words</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] bg-emerald-950/50 text-emerald-400 border border-emerald-900/40 px-2 py-1 uppercase font-bold tracking-wider">
                      Optimal state achieved
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#141414]/60 bg-white/20">
                <div className="w-16 h-16 rounded-full bg-[#141414]/10 flex items-center justify-center mb-4">
                  <Terminal size={32} className="text-[#141414]" />
                </div>
                <h3 className="text-base font-bold font-display uppercase tracking-tight">Optimizer Console Offline</h3>
                <p className="text-xs mt-2 max-w-sm leading-relaxed font-mono">
                  Enter or select a prompt in the left panel, configure your parameters, and trigger the engine to view optimized output, metrics, and pruned elements.
                </p>
                {history.length > 0 && (
                  <div className="mt-6 flex flex-col items-center">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Or quick restore from history:</span>
                    <button
                      onClick={() => handleSelectHistory(history[0])}
                      className="px-3 py-1.5 bg-white border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors text-xs font-mono font-semibold"
                    >
                      Restore latest optimization (-{history[0].result.estimatedTokenReduction}%)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer Metrics Panel & Log Display */}
      <footer className="shrink-0 border-t border-[#141414]">
        
        {/* Main analytical grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 bg-[#E4E3E0]">
          
          {/* Card 1: Token reduction percent */}
          <div className="p-4 md:p-6 border-b md:border-b-0 md:border-r border-[#141414] flex flex-col justify-between h-[150px] md:h-auto">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest mb-2 opacity-50 font-mono">Token Reduction</p>
              <p className="text-5xl md:text-6xl font-mono tracking-tighter font-bold text-[#141414]">
                {result ? result.estimatedTokenReduction : "00"}
                <span className="text-xl md:text-2xl font-normal">%</span>
              </p>
            </div>
            <div className="h-2 bg-white/40 w-full mt-4 border border-[#141414]/20">
              <div 
                className="h-full bg-[#141414] transition-all duration-1000 ease-out" 
                style={{ width: `${result ? result.estimatedTokenReduction : 0}%` }}
              />
            </div>
          </div>

          {/* Card 2: Quality score */}
          <div className="p-4 md:p-6 border-b md:border-b-0 md:border-r border-[#141414] flex flex-col justify-between h-[150px] md:h-auto">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest mb-2 opacity-50 font-mono">Quality Score</p>
              <p className="text-5xl md:text-6xl font-mono tracking-tighter font-bold text-[#141414]">
                {result ? result.qualityScore : "00"}
                <span className="text-xl md:text-2xl font-normal">/100</span>
              </p>
            </div>
            <div className="flex gap-1.5 mt-4">
              {Array.from({ length: 5 }).map((_, i) => {
                const scoreLimit = (i + 1) * 20;
                const score = result ? result.qualityScore : 0;
                const isLit = score >= scoreLimit;
                return (
                  <div 
                    key={i} 
                    className={`w-3.5 h-3.5 border border-[#141414] ${isLit ? "bg-[#141414]" : "bg-white/20"}`} 
                    title={`Score range ${scoreLimit - 20}-${scoreLimit}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Card 3 & 4: Analytical Logs and History (Dual column span on desktop) */}
          <div className="col-span-1 md:col-span-2 flex flex-col">
            <div className="flex-1 p-4 md:p-6 overflow-hidden max-h-[220px] overflow-y-auto">
              <p className="text-[10px] uppercase font-bold tracking-widest mb-3 opacity-50 font-mono">Optimization Logs</p>
              {result ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-2">
                    <p className="text-rose-600 font-bold leading-relaxed">
                      - Removed ({result.removed.length}):{" "}
                      <span className="font-normal text-slate-700">
                        {result.removed.slice(0, 4).map(r => `"${r}"`).join(", ")}
                        {result.removed.length > 4 ? "..." : ""}
                      </span>
                    </p>
                    <p className="text-blue-600 font-bold leading-relaxed">
                      ~ Simplified ({result.simplified.length}):{" "}
                      <span className="font-normal text-slate-700">
                        {result.simplified.slice(0, 3).join("; ")}
                        {result.simplified.length > 3 ? "..." : ""}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-green-600 font-bold leading-relaxed">
                      + Preserved:{" "}
                      <span className="font-normal text-slate-700">
                        {result.preserved.join(", ")}
                      </span>
                    </p>
                    <p className="italic text-[#141414] opacity-75 font-serif text-xs leading-relaxed">
                      Reason: {result.reason}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-mono text-slate-500 italic py-4">
                  Await processing parameters... Logs will compile automatically upon prompt optimization.
                </div>
              )}
            </div>

            {/* Utility bottom tray: System status / Export Options */}
            <div className="h-12 bg-[#D1D0CC] border-t border-[#141414] flex items-center px-4 md:px-6 gap-4 md:gap-6 shrink-0 flex-wrap overflow-hidden">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isLoading ? "bg-amber-500 animate-pulse" : "bg-green-600"}`}></div>
                <span className="text-[9px] font-bold uppercase tracking-wider font-mono">
                  {isLoading ? "Pruner Processing" : "Optimizer Ready"}
                </span>
              </div>
              
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase opacity-50 font-mono">Strategy:</span>
                <span className="text-[9px] font-mono font-bold bg-white/40 px-1.5 py-0.5 uppercase border border-[#141414]/10">
                  {mode}
                </span>
              </div>

              {result && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-[9px] font-bold uppercase opacity-50 font-mono">Export Output:</span>
                  <button
                    onClick={() => exportAsFile("json")}
                    className="text-[10px] font-mono underline hover:text-indigo-600 cursor-pointer font-bold"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => exportAsFile("md")}
                    className="text-[10px] font-mono underline hover:text-indigo-600 cursor-pointer font-bold"
                  >
                    Markdown
                  </button>
                  <button
                    onClick={() => exportAsFile("cli")}
                    className="text-[10px] font-mono underline hover:text-indigo-600 cursor-pointer font-bold"
                  >
                    API Payload
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </footer>

      {/* History and Advanced Info drawer */}
      {history.length > 0 && (
        <div className="border-t border-[#141414] bg-[#D1D0CC]/30 p-4 md:p-6 shrink-0">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6">
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3 border-b border-[#141414]/15 pb-2">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-[#141414]" />
                  <span className="text-xs font-bold uppercase tracking-widest font-mono">Optimization Logs History</span>
                </div>
                <button
                  onClick={handleClearHistory}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 uppercase tracking-wide font-mono"
                >
                  Clear History
                </button>
              </div>

              {/* Responsive history grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-40 overflow-y-auto pr-1">
                {history.map((item) => {
                  const isActive = activeHistoryId === item.id;
                  const snip = item.result.originalPrompt.length > 55
                    ? item.result.originalPrompt.substring(0, 55) + "..."
                    : item.result.originalPrompt;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectHistory(item)}
                      className={`p-3 border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                        isActive
                          ? "bg-[#141414] text-[#E4E3E0] border-[#141414]"
                          : "bg-white/60 border-slate-300 hover:border-[#141414] text-[#141414]"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1.5 mb-1 shrink-0">
                        <span className={`text-[9px] font-mono uppercase tracking-wider px-1 py-0.5 ${
                          isActive ? "bg-white/20 text-[#E4E3E0]" : "bg-black/5 text-slate-600"
                        }`}>
                          {item.mode}
                        </span>
                        <span className="text-[9px] font-mono opacity-50 shrink-0">{item.timestamp}</span>
                      </div>
                      <p className="text-[11px] line-clamp-2 leading-relaxed flex-1 font-mono">{snip}</p>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-current/10 shrink-0">
                        <span className="text-[10px] font-bold">-{item.result.estimatedTokenReduction}% tokens</span>
                        <button
                          onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                          className="opacity-60 hover:opacity-100 p-0.5 rounded text-rose-500 hover:bg-rose-50"
                          title="Delete record"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick guide card */}
            <div className="w-full md:w-80 bg-white/50 border border-[#141414] p-4 text-xs font-mono leading-relaxed flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-2 font-bold text-[#141414] uppercase">
                  <Info size={14} />
                  <span>Pruning Reference</span>
                </div>
                <p className="opacity-85 text-[11px]">
                  Large language models bill by token count and process context limits. Prompt pruning reduces bills and speeds up inference by removing fluff and repetitive elements while preserving all actual parameters.
                </p>
              </div>
              <div className="mt-4 pt-2 border-t border-[#141414]/15 text-[10px] opacity-60">
                Tip: Use **Aggressive** mode to generate extremely sparse instructions suitable for simple requests.
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
