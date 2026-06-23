import fs from 'fs';
import path from 'path';
import ImportClient from './ImportClient';

export const dynamic = 'force-dynamic';

export default async function ImportBackupPage() {
  const dbPath = 'C:\\Users\\shabu\\OneDrive\\เดสก์ท็อป\\Backup DB\\pool_tournament_db_export.json';
  let dbData = null;
  let errorMessage = null;

  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf8');
      dbData = JSON.parse(raw);
    } else {
      errorMessage = `Backup file not found at: ${dbPath}`;
    }
  } catch (err: any) {
    console.error('Error reading backup file:', err);
    errorMessage = `Error reading backup file: ${err.message || err}`;
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl text-white">
      <h1 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
        Import Backup DB
      </h1>
      <ImportClient data={dbData} error={errorMessage} />
    </div>
  );
}
