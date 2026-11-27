import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  Info,
  Play,
  ArrowRight,
  ShieldCheck,
  Package,
  Edit3,
  Trash2
} from 'lucide-react';
import { FoodItem, ScanResult, AppSettings, LanguageType } from '../../types';
import { SAMPLE_FRIDGE_PHOTOS } from '../../data/mockData';
import { t } from '../../utils/i18n';
import { downscaleImage } from '../../utils/image';
import { ItemModal } from '../ItemModal';
import {
  apiFetch,
  EmailVerificationRequiredError,
  TrialExpiredError,
} from '../../utils/api';

interface ScanScreenProps {
  settings?: AppSettings;
  onAddItemsToInventory: (items: FoodItem[]) => void;
  onNavigateToInventory: () => void;
}

export const ScanScreen: React.FC<ScanScreenProps> = ({
  settings,
  onAddItemsToInventory,
  onNavigateToInventory,
}) => {
  const lang = (settings?.language || 'en') as LanguageType;
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const mountedRef = useRef(true);
  const cameraRequest = useRef(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; cameraRequest.current += 1; };
  }, []);

  useEffect(() => {
    if (!cameraStream) return;
    if (videoRef.current) videoRef.current.srcObject = cameraStream;
    return () => cameraStream.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

  // Handle Photo Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result;
          if (typeof base64 !== 'string') throw new Error('Invalid image');
          setSelectedImage(await downscaleImage(base64));
          setScanResult(null);
          setErrorMsg(null);
        } catch {
          setErrorMsg(t('scanImageError', lang));
        }
      };
      reader.onerror = () => setErrorMsg(t('scanImageError', lang));
      e.target.value = '';
      reader.readAsDataURL(file);
    }
  };

  // Start Web Camera Feed
  const startCamera = async () => {
    const request = ++cameraRequest.current;
    try {
      setIsLiveCameraActive(true);
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (!mountedRef.current || request !== cameraRequest.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setCameraStream(stream);
    } catch (err) {
      if (!mountedRef.current || request !== cameraRequest.current) return;
      console.error('Camera access error:', err);
      setIsLiveCameraActive(false);
      setErrorMsg(t('scanCameraError', lang));
    }
  };

  // Capture Frame from Web Camera
  const captureFrame = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video.videoWidth || !video.videoHeight) {
        setErrorMsg(t('scanCameraNotReady', lang));
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          setSelectedImage(await downscaleImage(dataUrl));
          setScanResult(null);
          setErrorMsg(null);
          setCameraStream(null);
          setIsLiveCameraActive(false);
        } catch {
          setErrorMsg(t('scanImageError', lang));
        }
      }
    }
  };

  // Select Demo Sample Photo
  const handleSelectSample = (sample: typeof SAMPLE_FRIDGE_PHOTOS[0]) => {
    setSelectedImage(sample.thumbnail);
    setScanResult(null);
    setErrorMsg(null);
  };

  // Run scan on image
  const runAIScan = async () => {
    if (!selectedImage) return;

    setIsScanning(true);
    setErrorMsg(null);

    try {
      // Captured/uploaded photos are already downscaled data URLs. Sample photos
      // are remote URLs, so fetch them into a canvas to get real inline base64.
      const base64ToSend = selectedImage.startsWith('data:')
        ? selectedImage
        : await downscaleImage(selectedImage);


      // Send to server API
      const response = await apiFetch('/api/scan-fridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64ToSend,
          mimeType: 'image/jpeg',
          language: settings?.language || 'en',
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        setScanResult(data.data);
      } else {
        throw new Error(data.error || 'Failed to detect food items');
      }
    } catch (err: any) {
      console.error('Scan error:', err);

      if (err instanceof EmailVerificationRequiredError || err instanceof TrialExpiredError) return;
      setErrorMsg(t('scanFailed', lang));
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmAndSave = () => {
    if (scanResult?.itemsFound) {
      onAddItemsToInventory(scanResult.itemsFound);
      onNavigateToInventory();
    }
  };

  return (
    <div className="space-y-5 pb-20 max-w-md md:max-w-xl lg:max-w-2xl mx-auto">
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Hidden canvas for snapshot capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
        <h2 className="text-3xl font-black tracking-tighter leading-none text-slate-900 mb-1">
          {t('scanTitle', lang)}
        </h2>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">
          {t('scanSubtitle', lang)}
        </p>
      </div>

      <p className="px-1 text-xs leading-relaxed text-slate-600">{t('scanPhotoTip', lang)}</p>

      {/* Camera / Image Container */}
      <div className="bg-pine-deep rounded-3xl overflow-hidden shadow-lg border-4 border-cold/30 min-h-[280px] relative flex flex-col items-center justify-center text-white p-3">
        {isLiveCameraActive ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-64 object-contain rounded-2xl"
            />
            <div className="absolute bottom-3 flex items-center gap-3">
              <button
                onClick={captureFrame}
                className="px-6 py-2.5 rounded-full bg-cold text-pine-deep font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-2 hover:bg-cold/90 transition-all active:scale-95"
              >
                <Camera className="w-4 h-4" />
                {t('capturePhoto', lang)}
              </button>
              <button type="button" onClick={() => { cameraRequest.current += 1; setCameraStream(null); setIsLiveCameraActive(false); }} className="px-4 py-2.5 rounded-full bg-slate-800 text-white text-xs font-bold">
                {t('close', lang)}
              </button>
            </div>
          </div>
        ) : selectedImage ? (
          <div className="relative w-full">
            <img
              src={selectedImage}
              alt="Refrigerator Scan"
              className="w-full h-64 object-contain rounded-2xl"
            />
            <button
              onClick={() => { setSelectedImage(null); setScanResult(null); setErrorMsg(null); }}
              disabled={isScanning}
              className="absolute top-2 right-2 p-2 rounded-full bg-slate-900/80 text-white font-black hover:bg-slate-900 transition-colors"
              title="Clear photo"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="py-10 px-4 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-cold/15 text-cold flex items-center justify-center mx-auto border-2 border-cold/60">
              <Camera className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-lg uppercase tracking-tight text-white">{t('readyToScan', lang)}</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 font-medium">
                {t('scanPromptText', lang)}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                onClick={startCamera}
                className="w-full sm:w-auto justify-center px-4 py-3 rounded-2xl bg-cold text-pine-deep font-black text-xs uppercase tracking-widest flex items-center gap-1.5 shadow-md hover:bg-cold/90 hover:scale-105 active:scale-95 transition-all duration-200 hover:shadow-cold/40"
              >
                <Camera className="w-4 h-4" />
                {t('liveCamera', lang)}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto justify-center px-4 py-3 rounded-2xl bg-slate-800 text-slate-200 border border-slate-700 font-black text-xs uppercase tracking-widest flex items-center gap-1.5 hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <Upload className="w-4 h-4" />
                {t('uploadPhoto', lang)}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Banner if any */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action Scan Trigger */}
      {selectedImage && !scanResult && (
        <button
          onClick={runAIScan}
          disabled={isScanning}
          className="w-full py-3.5 px-5 rounded-2xl bg-cold text-pine-deep font-bold text-sm shadow-[0_16px_36px_-12px_rgba(34,197,94,0.7)] flex items-center justify-center gap-2 hover:bg-cold-dark hover:text-white active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isScanning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{t('analyzingBtn', lang)}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{t('analyzeBtn', lang)}</span>
            </>
          )}
        </button>
      )}

      {/* Sample Fridge Demo Cards */}
      {!scanResult && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {t('testDriveSample', lang)}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {SAMPLE_FRIDGE_PHOTOS.map((sample) => (
              <button
                key={sample.id}
                onClick={() => handleSelectSample(sample)}
                disabled={isScanning}
                className="group p-2 bg-white border border-slate-200/80 rounded-2xl text-left hover:border-cold transition-all shadow-xs"
              >
                <img
                  src={sample.thumbnail}
                  alt={sample.title}
                  className="w-full h-24 object-cover rounded-xl mb-2 group-hover:opacity-90"
                />
                <h4 className="font-bold text-slate-800 text-xs">{sample.title}</h4>
                <p className="text-[10px] text-slate-500 line-clamp-1">{sample.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scan Results Confirmation Screen */}
      {scanResult && (
        <div className="bg-white border border-cold/30 rounded-3xl p-5 shadow-lg space-y-4 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-pine bg-mint px-2.5 py-0.5 rounded-full ring-1 ring-cold/25">
                {t('aiDetectionComplete', lang)}
              </span>
              <h3 className="font-bold text-slate-800 text-base mt-1">
                {t('detectedCount', lang)}: {scanResult.itemsFound.length}
              </h3>
            </div>
            <button
              onClick={() => setScanResult(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700"
            >
              {t('rescan', lang)}
            </button>
          </div>

          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 italic">
            "{scanResult.summaryNotes}"
          </p>

          <p className="text-xs text-slate-600 leading-relaxed">{t('scanReviewHint', lang)}</p>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {scanResult.itemsFound.map((item, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold text-slate-800 flex items-start gap-1.5 flex-wrap break-words">
                    {item.name}
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({item.quantity} {item.unit})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {t('category', lang)}: {item.category} • {t('location', lang)}: {item.locationInFridge}
                  </div>
                  {item.notes && (
                    <div className="text-[10px] text-cold-dark font-semibold">{item.notes}</div>
                  )}
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingItem(item)} aria-label={`${t('edit', lang)} ${item.name}`} className="p-2 rounded-xl bg-white border border-slate-200 text-pine"><Edit3 className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setScanResult((current) => current ? { ...current, itemsFound: current.itemsFound.filter((entry) => entry.id !== item.id) } : null)} aria-label={`${t('delete', lang)} ${item.name}`} className="p-2 rounded-xl bg-white border border-slate-200 text-rose-700"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  {item.freshness === 'soon_to_expire' && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      {t('expiresIn', lang)} {item.daysRemaining}d
                    </span>
                  )}
                  {item.freshness === 'fresh' && (
                    <span className="px-2.5 py-1 rounded-full bg-mint text-pine font-bold text-[10px] border border-cold/25 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-cold-dark" />
                      {t('fresh', lang)} ({item.daysRemaining}d)
                    </span>
                  )}
                  {item.freshness === 'expired' && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-200">
                      {t('expired', lang)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleConfirmAndSave}
              disabled={scanResult.itemsFound.length === 0}
              className="disabled:opacity-50 w-full py-3 px-4 rounded-2xl bg-cold text-pine-deep font-bold text-sm shadow-[0_14px_30px_-12px_rgba(34,197,94,0.7)] hover:bg-cold-dark hover:text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('confirmAndAdd', lang)}</span>
            </button>
          </div>
        </div>
      )}

      {editingItem && (
        <ItemModal
          key={editingItem.id}
          isOpen
          initialItem={editingItem}
          language={lang}
          onClose={() => setEditingItem(null)}
          onSave={(updated) => setScanResult((current) => current ? { ...current, itemsFound: current.itemsFound.map((item) => item.id === updated.id ? updated : item) } : null)}
        />
      )}
    </div>
  );
};
