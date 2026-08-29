import { useRef, useState } from 'react';
import { Camera, ImageUp, Loader2, Plus, RotateCcw, ShieldAlert, TriangleAlert, X, Zap } from 'lucide-react';
import { compressImage } from './imageCompress.js';

const RISK_STYLES = {
  gering: { label: 'Unbedenklich', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  vorsicht: { label: 'Vorsicht', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  gefahr: { label: 'Fachperson hinzuziehen', className: 'bg-red-50 text-red-800 border-red-200' },
};

// Begrenzung passend zu Vercels hartem Payload-Limit für Serverless
// Functions (siehe api/analyze.js) - mehr Fotos würden trotz clientseitiger
// Kompression riskant nah an dieses Limit kommen.
const MAX_PHOTOS = 4;

async function analyzePhotos(photos) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images: photos.map(({ base64, mimeType }) => ({ image: base64, mimeType })),
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || 'Analyse fehlgeschlagen.');
  }
  return data;
}

export default function App() {
  const [status, setStatus] = useState('idle'); // idle | preview | loading | result | error
  const [photos, setPhotos] = useState([]); // [{ base64, mimeType, previewUrl }]
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const filesToAdd = files.slice(0, Math.max(0, MAX_PHOTOS - photos.length));
    if (!filesToAdd.length) return;
    try {
      const compressed = await Promise.all(filesToAdd.map(compressImage));
      setPhotos((prev) => [...prev, ...compressed]);
      setResult(null);
      setStatus('preview');
    } catch (error) {
      setErrorMessage(error.message);
      setStatus('error');
    }
  }

  function handleRemovePhoto(index) {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setStatus('idle');
      return next;
    });
  }

  async function handleAnalyze() {
    if (!photos.length) return;
    setStatus('loading');
    try {
      const data = await analyzePhotos(photos);
      setResult(data);
      setStatus('result');
    } catch (error) {
      setErrorMessage(error.message);
      setStatus('error');
    }
  }

  function handleReset() {
    setPhotos([]);
    setResult(null);
    setErrorMessage('');
    setStatus('idle');
  }

  const risk = result ? RISK_STYLES[result.riskLevel] || RISK_STYLES.gering : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gradient-to-r from-brand-dark to-brand text-white px-4 py-4 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Zap className="text-flash" fill="currentColor" size={26} />
          <div>
            <h1 className="text-lg font-bold leading-tight">Blitzdiagnose</h1>
            <p className="text-xs text-white/80 leading-tight">Foto rein, Rat raus</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFilesSelected}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />

        {status === 'idle' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
            <p className="text-slate-600 mb-6">
              Egal ob Haushalt, Technik, Garten oder Handwerk – ein Foto genügt,
              der Rest ist KI-Sache.
            </p>
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold py-4 rounded-xl transition-colors"
            >
              <Camera size={22} />
              Foto aufnehmen
            </button>
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 mt-3 border border-slate-300 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <ImageUp size={18} />
              Foto auswählen
            </button>
          </div>
        )}

        {status === 'preview' && photos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-2 gap-2 p-3">
              {photos.map((p, index) => (
                <div key={index} className="relative rounded-xl overflow-hidden border border-slate-200">
                  <img src={p.previewUrl} alt={`Foto ${index + 1}`} className="w-full h-32 object-cover" />
                  <button
                    onClick={() => handleRemovePhoto(index)}
                    aria-label="Foto entfernen"
                    className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-4 pb-4 flex flex-col gap-3">
              {photos.length < MAX_PHOTOS && (
                <div className="flex gap-3">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <Plus size={16} />
                    Foto
                  </button>
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <ImageUp size={16} />
                    Auswählen
                  </button>
                </div>
              )}
              <button
                onClick={handleAnalyze}
                className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold py-4 rounded-xl transition-colors"
              >
                <Zap size={20} />
                Analysieren{photos.length > 1 ? ` (${photos.length} Fotos)` : ''}
              </button>
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 text-slate-600 font-medium py-2 hover:text-slate-900 transition-colors"
              >
                <RotateCcw size={16} />
                Alle verwerfen
              </button>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 flex flex-col items-center gap-3 text-slate-600">
            <Loader2 className="animate-spin text-brand" size={36} />
            <p>Foto wird analysiert …</p>
          </div>
        )}

        {status === 'result' && result && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {photos.length > 0 && (
              photos.length === 1 ? (
                <img src={photos[0].previewUrl} alt="Analysiertes Foto" className="w-full max-h-64 object-cover" />
              ) : (
                <div className="grid grid-cols-2 gap-1 p-1">
                  {photos.map((p, index) => (
                    <img
                      key={index}
                      src={p.previewUrl}
                      alt={`Analysiertes Foto ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )
            )}
            <div className="p-5 flex flex-col gap-4">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide text-brand bg-brand/10 px-2 py-1 rounded-full mb-2">
                  {result.category}
                </span>
                <h2 className="text-xl font-bold text-slate-900">{result.title}</h2>
                <p className="text-slate-600 mt-1">{result.summary}</p>
              </div>

              {risk && (
                <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-sm font-medium ${risk.className}`}>
                  {result.riskLevel === 'gefahr' ? <ShieldAlert size={18} /> : <TriangleAlert size={18} />}
                  {risk.label}
                </div>
              )}

              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Tipps</h3>
                <ol className="flex flex-col gap-2">
                  {(result.tips || []).map((tip, index) => (
                    <li key={index} className="flex gap-3 text-slate-700">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand/10 text-brand text-sm font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-3 rounded-xl transition-colors"
              >
                <Camera size={18} />
                Neues Foto
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6 flex flex-col items-center gap-3 text-center">
            <TriangleAlert className="text-red-500" size={32} />
            <p className="text-slate-700">{errorMessage || 'Etwas ist schiefgelaufen.'}</p>
            <button
              onClick={handleReset}
              className="mt-2 flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              <RotateCcw size={16} />
              Erneut versuchen
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
