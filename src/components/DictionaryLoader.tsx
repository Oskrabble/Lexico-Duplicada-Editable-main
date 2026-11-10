import { useState, useRef } from 'react';
import { dictionary } from '@/game/dictionary';
import { Upload, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

interface DictionaryLoaderProps {
  onLoaded: () => void;
}

export function DictionaryLoader({ onLoaded }: DictionaryLoaderProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('loading');
    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const count = dictionary.loadFiseText(text);
        setWordCount(count);
        setStatus('loaded');
        onLoaded();
      } catch (err) {
        setStatus('error');
        setError('No se pudo leer el archivo. Asegúrate de que es un archivo de texto con una palabra por línea.');
      }
    };
    reader.onerror = () => {
      setStatus('error');
      setError('Error al leer el archivo.');
    };
    reader.readAsText(file);
  };

  if (status === 'loaded') {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600">
        <CheckCircle2 size={18} />
        <span>Diccionario FISE 2017 cargado: {wordCount.toLocaleString('es')} palabras</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={status === 'loading'}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50 shadow-md"
        >
          <Upload size={18} />
          {status === 'loading' ? 'Cargando...' : 'Subir diccionario FISE 2017'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-rose-600">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 text-sm text-gray-600 flex gap-3">
        <FileText size={20} className="text-violet-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-violet-800 mb-1">Formato del archivo</p>
          <p className="text-xs">
            Archivo de texto (.txt) con una palabra válida por línea.
            Los dígitos <span className="font-mono font-bold">1</span>, <span className="font-mono font-bold">2</span> y <span className="font-mono font-bold">3</span> representan
            los dígrafos <span className="font-bold">CH</span>, <span className="font-bold">LL</span> y <span className="font-bold">RR</span> respectivamente.
            Las palabras no llevan tildes y la Ñ se escribe como Ñ.
          </p>
        </div>
      </div>
    </div>
  );
}
