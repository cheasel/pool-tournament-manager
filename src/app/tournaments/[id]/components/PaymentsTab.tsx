import React from 'react';
import { TournamentDetails, Player, Tournament } from '@/types';
import { calculateTournamentEarnings } from '@/lib/earnings';
import { Trophy, Coins } from 'lucide-react';

interface PaymentsTabProps {
  details: TournamentDetails;
  tournament: Tournament;
  players: Player[];
  paymentCategory: 'entry' | 'calcuttaBid' | 'payout' | 'calcuttaPayout';
  setPaymentCategory: (cat: 'entry' | 'calcuttaBid' | 'payout' | 'calcuttaPayout') => void;
  onTogglePayment: (category: 'entry' | 'calcuttaBid' | 'payout' | 'calcuttaPayout', targetId: string) => Promise<void>;
  renderProgressMeter: (label: string, collected: number, expected: number) => React.ReactNode;
}

export default function PaymentsTab({
  details,
  tournament,
  players,
  paymentCategory,
  setPaymentCategory,
  onTogglePayment,
  renderProgressMeter,
}: PaymentsTabProps) {
  const allPlayers = players.filter(p => !p.isBye);
  const numRealPlayers = allPlayers.length;
  const entryFee = tournament.entryFee || 0;
  const expectedEntryPool = entryFee * numRealPlayers;
  const collectedEntryPool = entryFee * (tournament.entryFeePaidIds || []).filter(id => allPlayers.some(p => p.id === id)).length;

  const bids = tournament.calcuttaBids || [];
  const expectedCalcuttaPool = bids.reduce((sum, b) => sum + b.bidAmount, 0);
  const collectedCalcuttaPool = bids
    .filter(b => (tournament.calcuttaBidsPaidIds || []).includes(b.playerId))
    .reduce((sum, b) => sum + b.bidAmount, 0);

  // Compute expected payouts
  const earnings = calculateTournamentEarnings(details);
  const expectedPlayerPayout = earnings.reduce((sum, r) => sum + r.playerPayout, 0);
  const collectedPlayerPayout = earnings
    .filter(r => (tournament.playerPayoutPaidIds || []).includes(r.playerId))
    .reduce((sum, r) => sum + r.playerPayout, 0);

  const expectedOwnerPayout = tournament.hasCalcutta
    ? earnings.reduce((sum, r) => sum + r.ownerCalcuttaShare + r.playerCalcuttaShare, 0)
    : 0;
  const collectedOwnerPayout = tournament.hasCalcutta
    ? earnings
        .filter(r => (tournament.ownerPayoutPaidIds || []).includes(r.playerId))
        .reduce((sum, r) => sum + r.ownerCalcuttaShare + r.playerCalcuttaShare, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
        {/* Entry fee progress */}
        <div className="glass-panel rounded-2xl p-5 shadow-xl flex items-center border border-border/60">
          {renderProgressMeter('Entry Fees Collected', collectedEntryPool, expectedEntryPool)}
        </div>

        {/* Calcutta bids progress */}
        {tournament.hasCalcutta && (
          <div className="glass-panel rounded-2xl p-5 shadow-xl flex items-center border border-border/60">
            {renderProgressMeter('Calcutta Bids Collected', collectedCalcuttaPool, expectedCalcuttaPool)}
          </div>
        )}

        {/* Tournament payouts progress */}
        {tournament.status === 'completed' && (
          <div className="glass-panel rounded-2xl p-5 shadow-xl flex items-center border border-border/60">
            {renderProgressMeter('Placement Payouts Paid', collectedPlayerPayout, expectedPlayerPayout)}
          </div>
        )}

        {/* Calcutta payouts progress */}
        {tournament.status === 'completed' && tournament.hasCalcutta && (
          <div className="glass-panel rounded-2xl p-5 shadow-xl flex items-center border border-border/60">
            {renderProgressMeter('Calcutta Payouts Paid', collectedOwnerPayout, expectedOwnerPayout)}
          </div>
        )}
      </div>

      {/* Section selectors */}
      <div className="flex flex-wrap bg-slate-900/60 p-1 rounded-xl border border-border/40 self-start gap-1">
        <button
          onClick={() => setPaymentCategory('entry')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            paymentCategory === 'entry'
              ? 'bg-primary text-background shadow-md'
              : 'text-muted-foreground hover:text-white'
          }`}
        >
          Entry Fees
        </button>
        {tournament.hasCalcutta && (
          <button
            onClick={() => setPaymentCategory('calcuttaBid')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              paymentCategory === 'calcuttaBid'
                ? 'bg-primary text-background shadow-md'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            Calcutta Bids
          </button>
        )}
        {tournament.status === 'completed' && (
          <button
            onClick={() => setPaymentCategory('payout')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              paymentCategory === 'payout'
                ? 'bg-primary text-background shadow-md'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            Placement Payouts
          </button>
        )}
        {tournament.status === 'completed' && tournament.hasCalcutta && (
          <button
            onClick={() => setPaymentCategory('calcuttaPayout')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              paymentCategory === 'calcuttaPayout'
                ? 'bg-primary text-background shadow-md'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            Calcutta Payouts
          </button>
        )}
      </div>

      {/* Payments Table */}
      <div className="glass-panel rounded-2xl shadow-xl overflow-hidden border border-border/60 animate-fade-in">
        {paymentCategory === 'entry' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/40 border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                  <th className="py-4 px-6">Player Name</th>
                  <th className="py-4 px-6 text-right">Entry Fee</th>
                  <th className="py-4 px-6 text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-xs font-bold">
                {players.filter(p => !p.isBye).map(p => {
                  const isPaid = (tournament.entryFeePaidIds || []).includes(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-6 text-sm text-white font-black">{p.name}</td>
                      <td className="py-4 px-6 text-right text-slate-300">${tournament.entryFee || 0}</td>
                      <td className="py-4 px-6 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isPaid}
                            onChange={() => onTogglePayment('entry', p.id)}
                            className="rounded accent-primary bg-background border-border h-4 w-4"
                          />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {paymentCategory === 'calcuttaBid' && tournament.hasCalcutta && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/40 border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                  <th className="py-4 px-6">Player Purchased</th>
                  <th className="py-4 px-6">Buyer Name</th>
                  <th className="py-4 px-6 text-right">Bid Amount</th>
                  <th className="py-4 px-6 text-center">Split?</th>
                  <th className="py-4 px-6 text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-xs font-bold">
                {(tournament.calcuttaBids || []).map(bid => {
                  const pName = players.find(p => p.id === bid.playerId)?.name || 'Unknown';
                  const isPaid = (tournament.calcuttaBidsPaidIds || []).includes(bid.playerId);
                  return (
                    <tr key={bid.playerId} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-6 text-sm text-white font-black">{pName}</td>
                      <td className="py-4 px-6 text-slate-300">{bid.buyerName}</td>
                      <td className="py-4 px-6 text-right text-slate-300">${bid.bidAmount}</td>
                      <td className="py-4 px-6 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          bid.split ? 'bg-primary/15 text-primary' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {bid.split ? 'YES' : 'NO'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isPaid}
                            onChange={() => onTogglePayment('calcuttaBid', bid.playerId)}
                            className="rounded accent-primary bg-background border-border h-4 w-4"
                          />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {paymentCategory === 'payout' && tournament.status === 'completed' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/40 border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                  <th className="py-4 px-6 text-center w-16">Rank</th>
                  <th className="py-4 px-6">Player Name</th>
                  <th className="py-4 px-6 text-right">Payout Due</th>
                  <th className="py-4 px-6 text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-xs font-bold">
                {(() => {
                  const earningsList = calculateTournamentEarnings(details).filter(e => e.playerPayout > 0);
                  return earningsList.map(row => {
                    const isPaid = (tournament.playerPayoutPaidIds || []).includes(row.playerId);
                    return (
                      <tr key={row.playerId} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-4 px-6 text-center text-muted-foreground">
                          {row.rank === 1 ? '1st' : row.rank === 2 ? '2nd' : `${row.rank}th`}
                        </td>
                        <td className="py-4 px-6 text-sm text-white font-black">{row.playerName}</td>
                        <td className="py-4 px-6 text-right text-emerald-400">${row.playerPayout.toFixed(0)}</td>
                        <td className="py-4 px-6 text-center">
                          <label className="inline-flex items-center justify-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isPaid}
                              onChange={() => onTogglePayment('payout', row.playerId)}
                              className="rounded accent-primary bg-background border-border h-4 w-4"
                            />
                          </label>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}

        {paymentCategory === 'calcuttaPayout' && tournament.status === 'completed' && tournament.hasCalcutta && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/40 border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                  <th className="py-4 px-6">Purchased Player</th>
                  <th className="py-4 px-6">Recipient Name</th>
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6 text-right">Payout Due</th>
                  <th className="py-4 px-6 text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-xs font-bold">
                {(() => {
                  const earningsList = calculateTournamentEarnings(details).filter(e => e.calcuttaPayout > 0);
                  const rows: { key: string; playerName: string; recipientName: string; type: string; amount: number; isPaid: boolean; pId: string }[] = [];
                  
                  earningsList.forEach(e => {
                    const isPaid = (tournament.ownerPayoutPaidIds || []).includes(e.playerId);
                    if (e.hasCalcuttaSplit) {
                      rows.push({
                        key: `${e.playerId}-owner`,
                        playerName: e.playerName,
                        recipientName: e.calcuttaOwner,
                        type: 'Owner (50%)',
                        amount: e.ownerCalcuttaShare,
                        isPaid,
                        pId: e.playerId,
                      });
                      rows.push({
                        key: `${e.playerId}-player`,
                        playerName: e.playerName,
                        recipientName: e.playerName,
                        type: 'Player (50%)',
                        amount: e.playerCalcuttaShare,
                        isPaid,
                        pId: e.playerId,
                      });
                    } else {
                      rows.push({
                        key: `${e.playerId}-owner`,
                        playerName: e.playerName,
                        recipientName: e.calcuttaOwner,
                        type: 'Owner (100%)',
                        amount: e.ownerCalcuttaShare,
                        isPaid,
                        pId: e.playerId,
                      });
                    }
                  });

                  return rows.map(row => (
                    <tr key={row.key} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-6 text-sm text-white font-black">{row.playerName}</td>
                      <td className="py-4 px-6 text-slate-200">{row.recipientName}</td>
                      <td className="py-4 px-6 text-muted-foreground">{row.type}</td>
                      <td className="py-4 px-6 text-right text-emerald-400">${row.amount.toFixed(0)}</td>
                      <td className="py-4 px-6 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={row.isPaid}
                            onChange={() => onTogglePayment('calcuttaPayout', row.pId)}
                            className="rounded accent-primary bg-background border-border h-4 w-4"
                          />
                        </label>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
