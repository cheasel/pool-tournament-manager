'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ImportClientProps {
  data: any;
  error: string | null;
}

export default function ImportClient({ data, error }: ImportClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleImport = () => {
    if (!data) {
      setStatus('No data to import.');
      return;
    }

    try {
      const keys = [
        'ptm_players',
        'ptm_tournaments',
        'ptm_groups',
        'ptm_matches',
        'ptm_handicap_history',
        'ptm_handicap_races'
      ];

      keys.forEach(key => {
        if (data[key]) {
          localStorage.setItem(key, JSON.stringify(data[key]));
        }
      });

      setStatus('Success! Database imported successfully.');
      setTimeout(() => {
        router.push('/tournaments/v0tqponsz');
      }, 1500);
    } catch (err: any) {
      console.error('Import failed:', err);
      setStatus(`Import failed: ${err.message || err}`);
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-red-400 bg-red-950/30 border border-red-900/50 p-3 rounded-lg text-sm">
          {error}
        </p>
        <button
          onClick={() => router.refresh()}
          className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">
        Click below to import the tournament data from your backup database. This will overwrite your current local storage data.
      </p>
      
      {status && (
        <p className={`p-3 rounded-lg text-sm ${status.includes('Success') ? 'text-green-400 bg-green-950/30 border border-green-900/50' : 'text-red-400 bg-red-950/30 border border-red-900/50'}`}>
          {status}
        </p>
      )}

      <button
        onClick={handleImport}
        className="w-full px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg font-semibold shadow-lg transition"
      >
        Import DB Backup
      </button>

      <button
        onClick={() => router.push('/tournaments/v0tqponsz')}
        className="w-full px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg font-medium transition"
      >
        Go to Tournament Page without Importing
      </button>
    </div>
  );
}
