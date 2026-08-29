import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Cpu,
  Hammer,
  Home,
  ImageUp,
  Leaf,
  Lock,
  PawPrint,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UtensilsCrossed,
  X,
  Zap,
} from 'lucide-react';
import { compressImage } from './imageCompress.js';

const RISK_STYLES = {
  gering: {
    label: 'Unbedenklich',
    hint: 'Kannst du in Ruhe selbst angehen.',
    className: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    iconWrap: 'bg-emerald-100 text-emerald-600',
    Icon: ShieldCheck,
  },
  vorsicht: {
    label: 'Vorsicht geboten',
    hint: 'Geh behutsam vor und im Zweifel lieber nachfragen.',
    className: 'bg-amber-50 border-amber-100 text-amber-800',
    iconWrap: 'bg-amber-100 text-amber-600',
    Icon: TriangleAlert,
  },
  gefahr: {
    label: 'Fachperson hinzuziehen',
    hint: 'Bitte nicht selbst experimentieren – Profi ranlassen.',
    className: 'bg-red-50 border-red-100 text-red-800',
    iconWrap: 'bg-red-100 text-red-600',
    Icon: ShieldAlert,
  },
};

const CATEGORY_ICONS = [
  { icon: Leaf, match: /garten|pflanze|blume|rasen/i },
  { icon: PawPrint, match: /tier|hund|katze|haustier/i },
  { icon: UtensilsCrossed, match: /koch|küche|essen|lebensmittel/i },
  { icon: Hammer, match: /handwerk|reparatur|bau/i },
  { icon: Cpu, match: /technik|elektro|gerät|computer/i },
  { icon: Home, match: /haushalt|wohnung|zuhause/i },
];

function categoryIcon(category) {
  const found = CATEGORY_ICONS.find((entry) => entry.match.test(category || ''));
  return found?.icon || Sparkles;
}

const LOADING_STEPS = [
  'Foto wird hochgeladen …',
  'KI untersucht die Details …',
  'Passende Tipps werden formuliert …',
];

const TRUST_ITEMS = [
  { icon: Lock, label: 'Kein Login' },
  { icon: ShieldCheck, label: 'Nichts wird gespeichert' },
  { icon: Zap, label: 'Antwort in Sekunden' },
];

const KNOWN_CATEGORIES = ['Haushalt', 'Technik', 'Garten', 'Pflanzen', 'Handwerk', 'Kochen'];

async function analyzePhoto({ base64, mimeType }) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, mimeType }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || 'Analyse fehlgeschlagen.');
  }
  return data;
}

function LoadingStatus() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setStep((current) => (current + 1) % LOADING_STEPS.length);
    }, 1600);
    return () => clearInterval(id);
  }, []);
  return (
    <p key={step} className="animate-fade-up text-slate-500 font-medium text-center min-h-6">
      {LOADING_STEPS[step]}
    </p>
  );
}

export default function App() {
  const [status, setStatus] = useState('idle'); // idle | preview | loading | result | error
  const [photo, setPhoto] = useState(null); // { base64, mimeType, previewUrl }
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  async function handleFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      setResult(null);
      setStatus('preview');
    } catch (error) {
      setErrorMessage(error.message);
      setStatus('error');
    }
  }

  async function handleAnalyze() {
    if (!photo) return;
    setStatus('loading');
    try {
      const data = await analyzePhoto(photo);
      setResult(data);
      setStatus('result');
    } catch (error) {
      setErrorMessage(error.message);
      setStatus('error');
    }
  }

  function handleReset() {
    setPhoto(null);
    setResult(null);
    setErrorMessage('');
    setStatus('idle');
  }

  const risk = result ? RISK_STYLES[result.riskLevel] || RISK_STYLES.gering : null;
  const CategoryIcon = result ? categoryIcon(result.category) : Sparkles;

  return (
    <div className="min-h-dvh flex flex-col relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-brand-light/20 blur-3xl animate-blob" />
        <div
          className="absolute top-32 -right-20 w-72 h-72 rounded-full bg-flash/15 blur-3xl animate-blob"
          style={{ animationDelay: '4s' }}
        />
      </div>

      <header className="sticky top-0 z-20 bg-gradient-to-br from-brand-dark via-brand to-brand-light text-white px-4 py-4 shadow-lg shadow-brand-dark/20">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20 shrink-0">
            <Zap className="text-flash-light" fill="currentColor" size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-display font-extrabold leading-tight tracking-tight">Blitzdiagnose</h1>
            <p className="text-xs text-white/75 leading-tight">Foto rein, Rat raus</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-7 flex flex-col gap-6 relative z-10">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelected}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />

        {status === 'idle' && (
          <>
            <div className="animate-fade-up bg-white rounded-[2rem] shadow-xl shadow-slate-200/70 border border-slate-100 p-7 text-center">
              <div className="relative w-24 h-24 mx-auto mb-5">
                <div className="absolute inset-0 rounded-full bg-brand/10" />
                <div className="absolute inset-2 rounded-full bg-brand/10" />
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-brand to-brand-light flex items-center justify-center shadow-lg shadow-brand/30">
                  <Camera className="text-white" size={30} />
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-flash flex items-center justify-center shadow-md shadow-flash/40 ring-4 ring-white">
                  <Zap className="text-white" size={14} fill="currentColor" />
                </div>
              </div>

              <h2 className="font-display text-2xl font-extrabold text-slate-900 tracking-tight">
                Foto rein, Antwort raus
              </h2>
              <p className="text-slate-500 mt-2 mb-7 leading-relaxed">
                Egal ob Haushalt, Technik, Garten oder Handwerk – ein Foto genügt,
                der Rest ist KI-Sache.
              </p>

              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-brand-light hover:brightness-105 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-brand/30 transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
              >
                <Camera size={20} />
                Foto aufnehmen
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 mt-3 border-2 border-slate-200 text-slate-700 font-semibold py-3.5 rounded-2xl hover:border-brand/40 hover:bg-brand-50 transition-colors"
              >
                <ImageUp size={18} />
                Aus Galerie wählen
              </button>
            </div>

            <div className="animate-fade-up flex flex-col gap-3" style={{ animationDelay: '80ms' }}>
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                Erkennt automatisch, worum es geht
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {KNOWN_CATEGORIES.map((label) => (
                  <span
                    key={label}
                    className="bg-white border border-slate-200 rounded-full px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="animate-fade-up flex justify-center gap-x-5 gap-y-2 flex-wrap"
              style={{ animationDelay: '140ms' }}
            >
              {TRUST_ITEMS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Icon size={14} className="text-brand" />
                  {label}
                </div>
              ))}
            </div>
          </>
        )}

        {status === 'preview' && photo && (
          <div className="animate-fade-up bg-white rounded-[2rem] shadow-xl shadow-slate-200/70 border border-slate-100 overflow-hidden">
            <div className="relative">
              <img src={photo.previewUrl} alt="Ausgewähltes Foto" className="w-full max-h-96 object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
              <button
                onClick={handleReset}
                aria-label="Foto verwerfen"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center hover:bg-black/60 transition-colors"
              >
                <X size={18} />
              </button>
              <p className="absolute bottom-3 left-4 text-white text-sm font-semibold drop-shadow">
                Bereit zur Analyse
              </p>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <button
                onClick={handleAnalyze}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-brand-light hover:brightness-105 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-brand/30 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Sparkles size={20} />
                Analysieren
              </button>
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 text-slate-500 font-medium py-2 hover:text-slate-900 transition-colors"
              >
                <RotateCcw size={16} />
                Anderes Foto
              </button>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="animate-fade-up bg-white rounded-[2rem] shadow-xl shadow-slate-200/70 border border-slate-100 p-10 flex flex-col items-center gap-6">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-brand/15 border-t-brand animate-spin" />
              <div className="absolute inset-2.5 rounded-full bg-gradient-to-br from-brand to-brand-light flex items-center justify-center animate-pulse">
                <Sparkles className="text-white" size={22} />
              </div>
            </div>
            <LoadingStatus />
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-brand/40 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {status === 'result' && result && (
          <div className="animate-fade-up bg-white rounded-[2rem] shadow-xl shadow-slate-200/70 border border-slate-100 overflow-hidden">
            {photo?.previewUrl && (
              <div className="relative">
                <img src={photo.previewUrl} alt="Analysiertes Foto" className="w-full h-60 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <span className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur text-brand-dark text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full shadow-sm">
                  <CategoryIcon size={13} />
                  {result.category}
                </span>
                <h2 className="absolute bottom-0 inset-x-0 p-4 font-display text-xl font-extrabold text-white leading-tight drop-shadow-sm">
                  {result.title}
                </h2>
              </div>
            )}
            <div className="p-5 sm:p-6 flex flex-col gap-5">
              <p className="text-slate-600 leading-relaxed">{result.summary}</p>

              {risk && (
                <div className={`flex items-start gap-3 border rounded-2xl p-4 ${risk.className}`}>
                  <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${risk.iconWrap}`}>
                    <risk.Icon size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-sm leading-tight">{risk.label}</p>
                    <p className="text-xs opacity-80 mt-1 leading-relaxed">{risk.hint}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-display font-bold text-slate-900 mb-3">So gehst du vor</h3>
                <ol className="flex flex-col">
                  {(result.tips || []).map((tip, index) => (
                    <li key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-brand to-brand-light text-white text-sm font-bold flex items-center justify-center shadow-sm shadow-brand/30 z-10">
                          {index + 1}
                        </span>
                        {index < (result.tips || []).length - 1 && (
                          <span className="w-px flex-1 bg-slate-200 my-1" />
                        )}
                      </div>
                      <span className="text-slate-700 leading-relaxed pt-1 pb-4">{tip}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 rounded-2xl transition-colors"
              >
                <Camera size={18} />
                Neues Foto
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-fade-up bg-white rounded-[2rem] shadow-xl shadow-slate-200/70 border border-red-100 p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <TriangleAlert className="text-red-500" size={30} />
            </div>
            <div>
              <p className="font-display font-bold text-slate-900 mb-1">Ups, das hat nicht geklappt</p>
              <p className="text-slate-500 text-sm leading-relaxed">
                {errorMessage || 'Etwas ist schiefgelaufen.'}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="mt-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-2xl transition-colors"
            >
              <RotateCcw size={16} />
              Erneut versuchen
            </button>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-400 leading-relaxed px-4 mt-1">
          KI-generierte Einschätzung ohne Gewähr – ersetzt keine fachliche Beratung.
        </p>
      </main>
    </div>
  );
}
