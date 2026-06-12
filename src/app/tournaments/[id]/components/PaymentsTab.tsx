import React from 'react';
import { TournamentDetails, Player, Tournament } from '@/types';
import { calculateTournamentEarnings } from '@/lib/earnings';
import { useAuth } from '@/context/AuthContext';
import { Trophy, Coins, Info } from 'lucide-react';

interface PaymentsTabProps {
  details: TournamentDetails;
  tournament: Tournament;
  players: Player[];
  paymentCategory: 'entry' | 'calcuttaBid' | 'payout' | 'calcuttaPayout';
  setPaymentCategory: (cat: 'entry' | 'calcuttaBid' | 'payout' | 'calcuttaPayout') => void;
  onTogglePayment: (category: 'entry' | 'calcuttaBid' | 'payout' | 'calcuttaPayout', targetId: string | string[], forceState?: 'paid' | 'unpaid') => Promise<void>;
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
  const { isAuthenticated } = useAuth();
  const allPlayers = players.filter(p => !p.isBye);
  const numRealPlayers = allPlayers.length;
  const entryFee = tournament.entryFee || 0;
  const expectedEntryPool = entryFee * numRealPlayers;
  const collectedEntryPool = entryFee * (tournament.entryFeePaidIds || []).filter(id => allPlayers.some(p => p.id === id)).length;

  const bids = tournament.calcuttaBids || [];
  const expectedCalcuttaPool = bids.reduce((sum, b) => sum + b.bidAmount, 0);
  const collectedCalcuttaPool = bids.reduce((sum, b) => {
    const isPlayerPaid = (tournament.calcuttaBidsPaidIds || []).includes(b.playerId);
    const isBuyerPaid = b.split
      ? (tournament.calcuttaBidsPaidIds || []).includes(b.playerId + '-buyer')
      : isPlayerPaid;

    if (b.split) {
      let portion = 0;
      if (isPlayerPaid) portion += 0.5 * b.bidAmount;
      if (isBuyerPaid) portion += 0.5 * b.bidAmount;
      return sum + portion;
    } else {
      return sum + (isBuyerPaid ? b.bidAmount : 0);
    }
  }, 0);

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

      {/* Admin required lock warning */}
      {!isAuthenticated && (
        <div className="rounded-lg bg-billiard-orange/10 border border-billiard-orange/20 p-3 flex gap-2 text-xs text-billiard-orange font-bold animate-pulse">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Admin login required to settle and update payment status records.</span>
        </div>
      )}

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
                      <td className="py-4 px-6 text-right text-slate-300">฿{tournament.entryFee || 0}</td>
                      <td className="py-4 px-6 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isPaid}
                            onChange={() => onTogglePayment('entry', p.id)}
                            disabled={!isAuthenticated}
                            className="rounded accent-primary bg-background border-border h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {paymentCategory === 'calcuttaBid' && tournament.hasCalcutta && (() => {
          const personMap: Record<string, { expected: number; paid: number; associatedTargets: { targetId: string; portion: number; isPaid: boolean }[] }> = {};
          
          (tournament.calcuttaBids || []).forEach(bid => {
            const pName = players.find(p => p.id === bid.playerId)?.name || 'Unknown';
            const buyerName = bid.buyerName.trim() || 'Player (Self)';
            const resolvedBuyer = buyerName === 'Player (Self)' ? pName : buyerName;
            
            if (bid.split) {
              const halfAmount = bid.bidAmount / 2;
              
              // Player portion
              const isPlayerPaid = (tournament.calcuttaBidsPaidIds || []).includes(bid.playerId);
              if (!personMap[pName]) personMap[pName] = { expected: 0, paid: 0, associatedTargets: [] };
              personMap[pName].expected += halfAmount;
              if (isPlayerPaid) personMap[pName].paid += halfAmount;
              personMap[pName].associatedTargets.push({
                targetId: bid.playerId,
                portion: halfAmount,
                isPaid: isPlayerPaid,
              });
              
              // Buyer portion
              const isBuyerPaid = (tournament.calcuttaBidsPaidIds || []).includes(bid.playerId + '-buyer');
              if (!personMap[resolvedBuyer]) personMap[resolvedBuyer] = { expected: 0, paid: 0, associatedTargets: [] };
              personMap[resolvedBuyer].expected += halfAmount;
              if (isBuyerPaid) personMap[resolvedBuyer].paid += halfAmount;
              personMap[resolvedBuyer].associatedTargets.push({
                targetId: bid.playerId + '-buyer',
                portion: halfAmount,
                isPaid: isBuyerPaid,
              });
            } else {
              // Buyer portion (100%)
              const isBuyerPaid = (tournament.calcuttaBidsPaidIds || []).includes(bid.playerId);
              if (!personMap[resolvedBuyer]) personMap[resolvedBuyer] = { expected: 0, paid: 0, associatedTargets: [] };
              personMap[resolvedBuyer].expected += bid.bidAmount;
              if (isBuyerPaid) personMap[resolvedBuyer].paid += bid.bidAmount;
              personMap[resolvedBuyer].associatedTargets.push({
                targetId: bid.playerId,
                portion: bid.bidAmount,
                isPaid: isBuyerPaid,
              });
            }
          });

          const consolidatedList = Object.entries(personMap).map(([name, val]) => {
            const remaining = val.expected - val.paid;
            const isAllPaid = val.associatedTargets.every(t => t.isPaid);
            const targetIds = val.associatedTargets.map(t => t.targetId);
            return {
              name,
              expected: val.expected,
              paid: val.paid,
              remaining,
              targetIds,
              isAllPaid,
            };
          }).sort((a, b) => {
            if (b.remaining !== a.remaining) {
              return b.remaining - a.remaining;
            }
            return a.name.localeCompare(b.name);
          });

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/40 border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                    <th className="py-4 px-6">Person Name</th>
                    <th className="py-4 px-6 text-right">Total Owed</th>
                    <th className="py-4 px-6 text-right">Total Paid</th>
                    <th className="py-4 px-6 text-right">Remaining Balance</th>
                    <th className="py-4 px-6 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 text-xs font-bold">
                  {consolidatedList.map(item => (
                    <tr key={item.name} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-6 text-sm text-white font-black">{item.name}</td>
                      <td className="py-4 px-6 text-right text-slate-300">฿{item.expected.toFixed(0)}</td>
                      <td className="py-4 px-6 text-right text-emerald-400">฿{item.paid.toFixed(0)}</td>
                      <td className={`py-4 px-6 text-right ${item.remaining > 0 ? 'text-primary' : 'text-slate-400'}`}>
                        ฿{item.remaining.toFixed(0)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={item.isAllPaid}
                            onChange={() => onTogglePayment('calcuttaBid', item.targetIds, item.isAllPaid ? 'unpaid' : 'paid')}
                            disabled={!isAuthenticated}
                            className="rounded accent-primary bg-background border-border h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </label>
                      </td>
                    </tr>
                  ))}
                  {consolidatedList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No Calcutta bids recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}

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
                        <td className="py-4 px-6 text-right text-emerald-400">฿{row.playerPayout.toFixed(0)}</td>
                        <td className="py-4 px-6 text-center">
                          <label className="inline-flex items-center justify-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isPaid}
                              onChange={() => onTogglePayment('payout', row.playerId)}
                              disabled={!isAuthenticated}
                              className="rounded accent-primary bg-background border-border h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <td className="py-4 px-6 text-right text-emerald-400">฿{row.amount.toFixed(0)}</td>
                      <td className="py-4 px-6 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={row.isPaid}
                            onChange={() => onTogglePayment('calcuttaPayout', row.pId)}
                            disabled={!isAuthenticated}
                            className="rounded accent-primary bg-background border-border h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
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
