import React from 'react';
import { TournamentDetails, Tournament } from '@/types';
import { calculateTournamentEarnings } from '@/lib/earnings';
import { Trophy, Coins } from 'lucide-react';

interface EarningsTabProps {
  details: TournamentDetails;
  tournament: Tournament;
}

export default function EarningsTab({ details, tournament }: EarningsTabProps) {
  const allPlayers = details.players.filter(p => !p.isBye);
  const entryFee = tournament.entryFee || 0;
  const numRealPlayers = allPlayers.length;
  const totalPrizePool = entryFee * numRealPlayers;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-5 sm:grid-cols-2 animate-fade-in">
        {/* Entry Fee Pool Card */}
        <div className="glass-panel rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-extrabold text-white border-b border-border pb-2 flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-primary" />
            Tournament Prize Pool
          </h3>
          <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-border/40 text-xs">
            <div>
              <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Entry Fee</p>
              <p className="text-lg font-black text-white mt-0.5">฿{entryFee}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Total Paid Out</p>
              <p className="text-lg font-black text-emerald-400 mt-0.5">฿{totalPrizePool}</p>
            </div>
          </div>
        </div>

        {/* Calcutta Pool Card */}
        {tournament.hasCalcutta && (
          <div className="glass-panel rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-extrabold text-white border-b border-border pb-2 flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-primary" />
              Calcutta Bid Pool
            </h3>
            {(() => {
              const bids = tournament.calcuttaBids || [];
              const totalCalcuttaPool = bids.reduce((sum, b) => sum + b.bidAmount, 0);
              return (
                <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-border/40 text-xs">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Total Bids</p>
                    <p className="text-lg font-black text-white mt-0.5">{bids.length} players</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Total Paid Out</p>
                    <p className="text-lg font-black text-emerald-400 mt-0.5">฿{totalCalcuttaPool}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Details Table */}
      <div className="glass-panel rounded-2xl shadow-xl overflow-hidden border border-border/60 animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/40 border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                <th className="py-4 px-6 text-center w-16">Rank</th>
                <th className="py-4 px-6">Player Name</th>
                <th className="py-4 px-6 text-right">Player Payout</th>
                {tournament.hasCalcutta && (
                  <>
                    <th className="py-4 px-6">Calcutta Owner</th>
                    <th className="py-4 px-6 text-right">Owner Payout</th>
                    <th className="py-4 px-6 text-center">Split?</th>
                  </>
                )}
                <th className="py-4 px-6 text-right">Net Player</th>
                {tournament.hasCalcutta && (
                  <th className="py-4 px-6 text-right">Net Owner</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 text-xs font-bold">
              {(() => {
                const earnings = calculateTournamentEarnings(details);
                return earnings.map((row) => {
                  const rankLabel = row.rank === 1
                    ? '1st'
                    : row.rank === 2
                    ? '2nd'
                    : row.rank === 3
                    ? '3rd (Tied)'
                    : row.rank === 5
                    ? '5th (Tied)'
                    : `${row.rank}th (Tied)`;

                  return (
                    <tr key={row.playerId} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-6 text-center text-muted-foreground font-medium">
                        {row.rank === 1 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                            1
                          </span>
                        ) : row.rank === 2 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-300/10 text-slate-300 border border-slate-300/20">
                            2
                          </span>
                        ) : (
                          rankLabel
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-white font-black">{row.playerName}</td>
                      <td className="py-4 px-6 text-right text-slate-300">
                        {row.playerPayout > 0 ? `฿${row.playerPayout.toFixed(0)}` : '—'}
                      </td>
                      {tournament.hasCalcutta && (
                        <>
                          <td className="py-4 px-6 text-slate-200">
                            {row.calcuttaOwner ? (
                              row.calcuttaOwner2
                                ? `${row.calcuttaOwner} / ${row.calcuttaOwner2}`
                                : row.calcuttaOwner
                            ) : '—'}
                          </td>
                          <td className="py-4 px-6 text-right text-slate-300">
                            {row.ownerCalcuttaShare > 0 ? (
                              row.calcuttaOwner2 && row.owner2CalcuttaShare !== undefined && row.owner2CalcuttaShare > 0
                                ? `฿${row.ownerCalcuttaShare.toFixed(0)} / ฿${row.owner2CalcuttaShare.toFixed(0)}`
                                : `฿${row.ownerCalcuttaShare.toFixed(0)}`
                            ) : '—'}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {row.calcuttaOwner ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                row.hasCalcuttaSplit
                                  ? 'bg-primary/15 text-primary'
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {row.hasCalcuttaSplit ? 'YES' : 'NO'}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </>
                      )}
                      <td className={`py-4 px-6 text-right ${row.netPlayerEarnings >= 0 ? 'text-primary' : 'text-billiard-red'}`}>
                        {row.netPlayerEarnings >= 0 ? '+' : ''}฿{row.netPlayerEarnings.toFixed(0)}
                      </td>
                      {tournament.hasCalcutta && (
                        <td className={`py-4 px-6 text-right ${row.netOwnerEarnings >= 0 ? 'text-primary' : 'text-billiard-red'}`}>
                          {row.calcuttaOwner ? (
                            row.calcuttaOwner2 && row.netOwner2Earnings !== undefined
                              ? `${row.netOwnerEarnings >= 0 ? '+' : ''}฿${row.netOwnerEarnings.toFixed(0)} / ${row.netOwner2Earnings >= 0 ? '+' : ''}฿${row.netOwner2Earnings.toFixed(0)}`
                              : `${row.netOwnerEarnings >= 0 ? '+' : ''}฿${row.netOwnerEarnings.toFixed(0)}`
                          ) : '—'}
                        </td>
                      )}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
