import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Receipt, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Leaf, 
  History, 
  Box, 
  AlertCircle,
  Loader2,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInDays, addDays, isPast } from 'date-fns';

interface InventoryItem {
  id: string;
  name: string;
  price: number;
  weightGrams: number;
  daysToEat: number;
  addedAt: string;
  status: 'live' | 'consumed' | 'wasted';
}

interface AppData {
  inventory: InventoryItem[];
  history: InventoryItem[];
  totalSavings: number;
  totalCarbonAvoided: number;
}

export default function App() {
  const [data, setData] = useState<AppData>({
    inventory: [],
    history: [],
    totalSavings: 0,
    totalCarbonAvoided: 0
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) {
        const text = await res.text();
        console.error(`API Error (${res.status}):`, text);
        return;
      }
      const d = await res.json();
      setData(d);
    } catch (err) {
      console.error("Fetch Data Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        
        canvasRef.current.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            stopCamera();
            await processReceipt(file);
          }
        }, 'image/jpeg');
      }
    }
  };

  const processReceipt = async (file: File) => {
    setProcessing(true);
    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const res = await fetch('/api/process-receipt', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processReceipt(file);
  };

  const handleAction = async (itemId: string, action: 'consumed' | 'wasted') => {
    try {
      const res = await fetch('/api/log-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, action })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getItemStatus = (item: InventoryItem) => {
    const expiryDate = addDays(new Date(item.addedAt), item.daysToEat);
    const daysLeft = differenceInDays(expiryDate, new Date());
    
    if (daysLeft < 0) return { label: 'Expired', color: 'text-red-500 bg-red-100', icon: AlertCircle };
    if (daysLeft <= 2) return { label: 'Expires Soon', color: 'text-orange-500 bg-orange-100', icon: Clock };
    return { label: `${daysLeft} days left`, color: 'text-emerald-500 bg-emerald-100', icon: CheckCircle2 };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-slate-900 font-sans selection:bg-orange-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 p-1.5 rounded-lg">
              <Box className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">GroodAI</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={startCamera}
              disabled={processing}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
              title="Camera Scan"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="group relative inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Receipt className="w-4 h-4" />
              )}
              {processing ? 'Analyzing...' : 'Snap Receipt'}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden" 
                accept="image/*"
              />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-50 rounded-xl">
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </div>
              <span className="text-sm font-medium text-slate-500">Total Savings</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-slate-900">${data.totalSavings.toFixed(2)}</span>
              <span className="text-slate-400 text-sm">this month</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-xl">
                  <Leaf className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="text-sm font-medium text-slate-500">Eco-Impact</span>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Level 1</span>
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-bold text-slate-900">{data.totalCarbonAvoided.toFixed(1)}kg</span>
              <span className="text-slate-400 text-sm">CO₂e avoided</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-1000" 
                style={{ width: `${Math.min((data.totalCarbonAvoided / 10) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Final goal: 10kg saved this month</p>
          </motion.div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 mb-6 bg-slate-100 p-1 rounded-full w-fit">
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Live Inventory
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            History
          </button>
        </div>

        {/* Inventory List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {(activeTab === 'inventory' ? data.inventory : data.history).map((item, idx) => {
              const status = getItemStatus(item);
              const StatusIcon = status.icon;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                      <Box className="w-6 h-6 text-slate-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{item.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-mono text-slate-400">${item.price.toFixed(2)}</span>
                        <span className="text-xs text-slate-400">{item.weightGrams}g</span>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </div>
                      </div>
                    </div>
                  </div>

                  {item.status === 'live' && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleAction(item.id, 'consumed')}
                        className="p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-500 rounded-lg transition-colors"
                        title="Mark as Consumed"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleAction(item.id, 'wasted')}
                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                        title="Mark as Wasted"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  {item.status !== 'live' && (
                    <div className="flex items-center gap-2">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        item.status === 'consumed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {(activeTab === 'inventory' ? data.inventory : data.history).length === 0 && (
            <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
              <div className="flex flex-col items-center gap-3">
                <Box className="w-10 h-10 text-slate-300" />
                <p className="text-slate-500 font-medium">
                  {activeTab === 'inventory' ? "Inventory is empty" : "No history yet"}
                </p>
                {activeTab === 'inventory' && (
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-orange-500 text-sm font-semibold hover:underline"
                  >
                    Snap your first receipt
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
          >
            <div className="relative w-full max-w-2xl aspect-[3/4] bg-slate-900 overflow-hidden">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-2 border-dashed border-white/30 pointer-events-none m-8" />
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="mt-8 flex items-center gap-8">
              <button 
                onClick={stopCamera}
                className="w-14 h-14 flex items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                title="Cancel"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
              
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-4 border-slate-300 active:scale-95 transition-transform"
                title="Capture"
              >
                <div className="w-16 h-16 rounded-full border-2 border-slate-900" />
              </button>

              <div className="w-14" /> {/* Spacer */}
            </div>
            
            <p className="mt-6 text-white/60 text-sm font-medium">Align receipt within the frame</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Indicator */}
      {processing && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-100 flex items-center gap-3 animate-bounce">
            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
            <span className="text-sm font-medium">GroodAI is auditing your receipt...</span>
          </div>
        </div>
      )}
    </div>
  );
}
