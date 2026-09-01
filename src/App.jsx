import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Cpu,
  Hammer,
  Home,
  ImageUp,
  Leaf,
  Check,
  Lock,
  PawPrint,
  RotateCcw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  TriangleAlert,
  UtensilsCrossed,
  Volume2,
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
  'Foto(s) werden hochgeladen …',
  'KI untersucht die Details …',
  'Passende Tipps werden formuliert …',
];

// Grenze bewusst niedrig gehalten: jedes komprimierte Foto ist idealerweise
// unter ~500KB (siehe imageCompress.js), aber Vercels hartes 4,5MB-
// Payload-Limit für die gesamte Anfrage bleibt der eigentliche Deckel (siehe
// Größen-Check in api/analyze.js).
const MAX_PHOTOS = 5;

function makePhotoId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const TRUST_ITEMS = [
  { icon: Lock, label: 'Kein Login' },
  { icon: ShieldCheck, label: 'Nichts wird gespeichert' },
  { icon: Zap, label: 'Antwort in Sekunden' },
];

const KNOWN_CATEGORIES = ['Haushalt', 'Technik', 'Garten', 'Pflanzen', 'Handwerk', 'Kochen'];

const supportsSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
const supportsShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const supportsClipboard =
  typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function';

function buildSpeechText(result, riskLabel) {
  const parts = [result.title, result.summary];
  if (riskLabel) parts.push(riskLabel);
  if (result.tips?.length) {
    parts.push('So gehst du vor:');
    result.tips.forEach((tip, index) => parts.push(`${index + 1}. ${tip}`));
  }
  return parts.filter(Boolean).join('. ');
}

function buildShareText(result, riskLabel) {
  const lines = [result.title, '', result.summary];
  if (riskLabel) lines.push('', `⚠️ ${riskLabel}`);
  if (result.tips?.length) {
    lines.push('', 'So gehst du vor:');
    result.tips.forEach((tip, index) => lines.push(`${index + 1}. ${tip}`));
  }
  lines.push('', 'Erstellt mit Blitzdiagnose ⚡');
  return lines.join('\n');
}

// Codes documented at https://developer.mozilla.org/docs/Web/API/SpeechSynthesisErrorEvent/error
const SPEECH_ERROR_HINTS = {
  'synthesis-failed':
    'Das ist meist ein vorübergehender Fehler der Sprachausgabe deines Geräts (bekanntes Android-Problem). ' +
    'Prüfe im Play Store auf Updates für "Sprachausgabe von Google" bzw. deine Sprachausgabe-App und versuch es erneut.',
  'synthesis-unavailable': 'Auf diesem Gerät ist gerade keine Sprachausgabe-Engine verfügbar.',
  'language-unavailable':
    'Für Deutsch ist keine Stimme installiert. Lade sie unter Android-Einstellungen → Bedienungshilfen → ' +
    'Text-in-Sprache-Ausgabe nach.',
  'voice-unavailable': 'Die gewählte Stimme ist auf diesem Gerät nicht verfügbar.',
  'not-allowed': 'Die Sprachausgabe wurde vom Browser blockiert.',
};

// A handful of Android/Chrome combinations fail the first speak() attempt
// with a transient error and succeed right after - worth one silent retry
// before bothering the user with it.
const RETRYABLE_SPEECH_ERRORS = new Set(['synthesis-failed', 'synthesis-unavailable']);

async function analyzePhotos(photos, comment) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images: photos.map(({ base64, mimeType }) => ({ image: base64, mimeType })),
      comment: comment?.trim() || undefined,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // Eine leere/nicht-JSON-Antwort (data === null) bedeutet meist, dass die
    // Anfrage nie unseren Handler erreicht hat oder verlassen hat, bevor er
    // antworten konnte (z.B. Plattform-Timeout) - dafür eine konkretere
    // Meldung als den generischen Fallback.
    if (!data) {
      throw new Error(
        response.status === 504
          ? 'Die Analyse hat zu lange gedauert. Bitte versuche es erneut.'
          : 'Analyse fehlgeschlagen. Bitte versuche es erneut.'
      );
    }
    throw new Error(data.error || 'Analyse fehlgeschlagen.');
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
  const [photos, setPhotos] = useState([]); // [{ id, base64, mimeType, previewUrl }]
  const [comment, setComment] = useState('');
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState('');
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  // Keeps the SpeechSynthesisUtterance alive for the duration of playback -
  // without an external reference some browsers (notably Safari) garbage
  // collect it mid-flight and speech silently never starts.
  const utteranceRef = useRef(null);
  // Guards the delayed retry below from restarting speech after the user
  // has already pressed "stop" during the retry's brief delay.
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    if (!supportsSpeech) return;
    // Triggers Chrome's async voice-list loading early so the first
    // "Ergebnis vorlesen" click isn't the one that kicks it off.
    window.speechSynthesis.getVoices();
    return () => window.speechSynthesis.cancel();
  }, []);

  async function handleFileSelected(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    const filesToAdd = files.slice(0, Math.max(0, MAX_PHOTOS - photos.length));
    if (filesToAdd.length === 0) return;
    try {
      const compressed = await Promise.all(filesToAdd.map(compressImage));
      setPhotos((current) => [
        ...current,
        ...compressed.map((photo) => ({ ...photo, id: makePhotoId() })),
      ]);
      setResult(null);
      setStatus('preview');
    } catch (error) {
      setErrorMessage(error.message);
      setStatus('error');
    }
  }

  function handleRemovePhoto(id) {
    const next = photos.filter((photo) => photo.id !== id);
    setPhotos(next);
    if (next.length === 0) setStatus('idle');
  }

  async function handleAnalyze() {
    if (photos.length === 0) return;
    setStatus('loading');
    try {
      const data = await analyzePhotos(photos, comment);
      setResult(data);
      setStatus('result');
    } catch (error) {
      setErrorMessage(error.message);
      setStatus('error');
    }
  }

  function handleReset() {
    stopRequestedRef.current = true;
    if (supportsSpeech) window.speechSynthesis.cancel();
    setSpeaking(false);
    setSpeechError('');
    setPhotos([]);
    setComment('');
    setResult(null);
    setErrorMessage('');
    setStatus('idle');
  }

  function handleToggleSpeech() {
    if (!supportsSpeech || !result) return;
    if (speaking) {
      stopRequestedRef.current = true;
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    stopRequestedRef.current = false;
    setSpeechError('');
    const voices = window.speechSynthesis.getVoices();
    // Chrome on Android silently produces no sound (no error either) when
    // the device has no text-to-speech voice/engine installed - surfacing
    // that here at least tells the user where to look instead of a dead
    // button.
    if (voices.length === 0) {
      setSpeechError(
        'Keine Sprachausgabe auf diesem Gerät gefunden. Prüfe unter Android in den Einstellungen ' +
          'unter "Bedienungshilfen" oder "Sprache & Eingabe" → "Text-in-Sprache-Ausgabe", ob eine ' +
          'Engine mit deutscher Stimme installiert ist.'
      );
    }
    // Passing an explicit voice object (rather than leaving the browser to
    // resolve "de-DE" itself) sidesteps a class of Android-Chrome failures
    // where letting the engine pick the voice triggers "synthesis-failed".
    const germanVoice = voices.find((v) => v.lang === 'de-DE') || voices.find((v) => v.lang?.startsWith('de'));
    const text = buildSpeechText(result, risk?.label);

    const speakOnce = (isRetry) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = germanVoice?.lang || 'de-DE';
      if (germanVoice) utterance.voice = germanVoice;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = (event) => {
        if (!isRetry && RETRYABLE_SPEECH_ERRORS.has(event.error)) {
          window.speechSynthesis.cancel();
          setTimeout(() => {
            if (!stopRequestedRef.current) speakOnce(true);
          }, 300);
          return;
        }
        setSpeaking(false);
        const hint = SPEECH_ERROR_HINTS[event.error];
        setSpeechError(`Sprachausgabe fehlgeschlagen (${event.error || 'unbekannter Fehler'}).${hint ? ` ${hint}` : ''}`);
      };
      // Keep a strong reference so the browser can't garbage-collect the
      // utterance before it finishes speaking (see note on utteranceRef above).
      utteranceRef.current = utterance;
      // Defensive reset for browsers/devices that leave speechSynthesis stuck
      // "paused" (e.g. after the tab was backgrounded) - resume() is a no-op
      // otherwise.
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    };

    // Calling cancel() right before speak() makes Chrome silently drop the
    // new utterance (well-known bug), so only cancel above when actually
    // stopping playback - never as a "just in case" reset before speaking.
    speakOnce(false);
    setSpeaking(true);
  }

  async function handleShare() {
    if (!result) return;
    setShareError('');
    const text = buildShareText(result, risk?.label);
    if (supportsShare) {
      try {
        await navigator.share({ title: result.title, text });
      } catch (error) {
        // AbortError = user cancelled the native share sheet - not an error.
        if (error?.name !== 'AbortError') {
          setShareError('Teilen fehlgeschlagen.');
        }
      }
      return;
    }
    if (supportsClipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch {
        setShareError('Kopieren fehlgeschlagen.');
      }
    }
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
          multiple
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
              <p className="text-xs text-slate-400 mt-4">
                Auch mehrere Fotos möglich – z.B. für verschiedene Blickwinkel oder Details.
              </p>
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

        {status === 'preview' && photos.length > 0 && (
          <div className="animate-fade-up bg-white rounded-[2rem] shadow-xl shadow-slate-200/70 border border-slate-100 overflow-hidden">
            <div className="p-5 pb-1">
              <p className="text-sm font-semibold text-slate-500 mb-3">
                {photos.length} {photos.length === 1 ? 'Foto' : 'Fotos'} bereit zur Analyse
                {photos.length < MAX_PHOTOS && ` · bis zu ${MAX_PHOTOS} möglich`}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((item) => (
                  <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                    <img src={item.previewUrl} alt="Ausgewähltes Foto" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemovePhoto(item.id)}
                      aria-label="Foto entfernen"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 backdrop-blur text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    aria-label="Weiteres Foto hinzufügen"
                    className="aspect-square rounded-xl border-2 border-dashed border-slate-200 text-slate-400 flex flex-col items-center justify-center gap-1 hover:border-brand/40 hover:text-brand transition-colors"
                  >
                    <ImageUp size={20} />
                    <span className="text-[11px] font-medium">Hinzufügen</span>
                  </button>
                )}
              </div>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value.slice(0, 500))}
                placeholder="Noch etwas dazu? z.B. seit wann das Problem besteht oder was du schon versucht hast (optional)"
                rows={2}
                maxLength={500}
                className="mt-4 w-full resize-none rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand/40 transition-colors"
              />
            </div>
            <div className="p-5 pt-1 flex flex-col gap-3">
              <button
                onClick={handleAnalyze}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-brand-light hover:brightness-105 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-brand/30 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Sparkles size={20} />
                Analysieren
              </button>
              {photos.length < MAX_PHOTOS && (
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-700 font-semibold py-3 rounded-2xl hover:border-brand/40 hover:bg-brand-50 transition-colors"
                >
                  <Camera size={16} />
                  Weiteres Foto aufnehmen
                </button>
              )}
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 text-slate-500 font-medium py-2 hover:text-slate-900 transition-colors"
              >
                <RotateCcw size={16} />
                Alle verwerfen
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
            {photos[0]?.previewUrl && (
              <div className="relative">
                <img src={photos[0].previewUrl} alt="Analysiertes Foto" className="w-full h-60 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <span className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur text-brand-dark text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full shadow-sm">
                  <CategoryIcon size={13} />
                  {result.category}
                </span>
                {photos.length > 1 && (
                  <span className="absolute top-3 right-3 bg-white/90 backdrop-blur text-brand-dark text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                    +{photos.length - 1} weitere
                  </span>
                )}
                <h2 className="absolute bottom-0 inset-x-0 p-4 font-display text-xl font-extrabold text-white leading-tight drop-shadow-sm">
                  {result.title}
                </h2>
              </div>
            )}
            <div className="p-5 sm:p-6 flex flex-col gap-5">
              <p className="text-slate-600 leading-relaxed">{result.summary}</p>

              {supportsSpeech && (
                <button
                  onClick={handleToggleSpeech}
                  aria-pressed={speaking}
                  className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-2xl border-2 transition-colors ${
                    speaking
                      ? 'bg-brand border-brand text-white'
                      : 'border-brand/25 text-brand hover:bg-brand-50'
                  }`}
                >
                  {speaking ? <Square size={15} fill="currentColor" /> : <Volume2 size={18} />}
                  {speaking ? 'Vorlesen stoppen' : 'Ergebnis vorlesen'}
                </button>
              )}

              {speechError && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed -mt-2">
                  {speechError}
                </p>
              )}

              {(supportsShare || supportsClipboard) && (
                <button
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-2xl border-2 border-brand/25 text-brand hover:bg-brand-50 transition-colors"
                >
                  {shareCopied ? <Check size={18} /> : <Share2 size={18} />}
                  {shareCopied ? 'In Zwischenablage kopiert' : supportsShare ? 'Ergebnis teilen' : 'Ergebnis kopieren'}
                </button>
              )}

              {shareError && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed -mt-2">
                  {shareError}
                </p>
              )}

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
        <p className="text-center text-[10px] text-slate-300">Blitzdiagnose v{__APP_VERSION__}</p>
      </main>
    </div>
  );
}
