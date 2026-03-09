import { useState, useEffect } from "react";
import { getAccounts, getTransactions } from "../api";
import { useProfile } from "../hooks/useProfile";
import "./Payout.css";

const formatMoney = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Payout() {
  const { displayName, username } = useProfile();
  const [accounts, setAccounts] = useState<{ id: string; type: string; balanceCents: number }[]>([]);
  const [transactions, setTransactions] = useState<{ id: string; type: string; amountCents: number; createdAt: string; status?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAccounts(), getTransactions(30)])
      .then(([accList, txList]) => {
        const list = Array.isArray(txList) ? txList : (txList as { transactions?: unknown[] })?.transactions ?? [];
        setAccounts(Array.isArray(accList) ? accList : []);
        setTransactions(list);
      })
      .finally(() => setLoading(false));
  }, []);

  const holding = accounts.find((a) => a.type === "holding");
  const availableCents = holding?.balanceCents ?? 0;
  const withdrawalTxns = transactions.filter((t) => t.type === "withdrawal" || t.type === "withdraw");
  const totalWithdrawnCents = withdrawalTxns.reduce((s, t) => s + t.amountCents, 0);
  const canWithdrawCents = Math.max(0, availableCents - 2000);

  if (loading) {
    return <div className="payout-page"><div className="payout-loading">Loading…</div></div>;
  }

  const drawMoneyRows = withdrawalTxns.length > 0
    ? withdrawalTxns.slice(0, 10).map((t) => ({
        id: `#${(t.id || "").slice(-6)}`,
        startDate: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : "—",
        amountWithdraw: t.amountCents,
        canWithdraw: Math.round(t.amountCents * 0.5),
        degree: "02",
        status: t.status || "Success",
      }))
    : [{ id: "#185941", startDate: "2024-11-28", amountWithdraw: 4000000, canWithdraw: 2000000, degree: "02", status: "Payout Request" }];

  return (
    <div className="payout-page">
      <header className="payout-header">
        <h1>Payout</h1>
        <div className="payout-header-right">
          <div className="payout-search-wrap">
            <span className="payout-search-icon">⌕</span>
            <input type="search" className="payout-search" placeholder="Search" />
          </div>
          <button type="button" className="payout-icon-btn" aria-label="Notifications">🔔</button>
          <div className="payout-user">
            <div className="payout-avatar">👤</div>
            <div>
              <span className="payout-username">{username}</span>
              <span className="payout-name">{displayName}</span>
            </div>
            <span className="payout-chev">▼</span>
          </div>
        </div>
      </header>

      <div className="payout-banner">
        <h2>Request Your Payouts</h2>
        <p>Minimum payout amount for withdrawal is $20. Complete KYC verification to enable payout requests.</p>
      </div>

      <div className="payout-cards">
        <div className="payout-stat-card payout-stat-card--green">
          <div className="payout-stat-icon">📈</div>
          <h3>Available withdrawal Accounts</h3>
          <p className="payout-stat-value">{formatMoney(availableCents)}</p>
          <p className="payout-stat-change">+{(availableCents / 100).toLocaleString()}</p>
          <div className="payout-stat-chart payout-stat-chart--green" />
        </div>
        <div className="payout-stat-card payout-stat-card--red">
          <div className="payout-stat-icon">📉</div>
          <h3>Can Withdraw</h3>
          <p className="payout-stat-pct">▲ 2.91%</p>
          <p className="payout-stat-value">{formatMoney(canWithdrawCents)}</p>
          <p className="payout-stat-change">-2,06.40</p>
          <div className="payout-stat-chart payout-stat-chart--red" />
        </div>
        <div className="payout-stat-card payout-stat-card--orange">
          <div className="payout-stat-icon">📊</div>
          <h3>Amount Withdraw</h3>
          <p className="payout-stat-pct">▲ 0.2%</p>
          <p className="payout-stat-value">{formatMoney(totalWithdrawnCents)}</p>
          <p className="payout-stat-change">3,063.40</p>
          <div className="payout-stat-chart payout-stat-chart--orange" />
        </div>
      </div>

      <section className="payout-draw">
        <h2>📄 Draw Money</h2>
        <table className="payout-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Select all" /></th>
              <th>ID</th>
              <th>Start Date</th>
              <th>Amount Withdraw</th>
              <th>Can Withdraw</th>
              <th>Degree</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {drawMoneyRows.map((row) => (
              <tr key={row.id}>
                <td><input type="checkbox" /></td>
                <td>{row.id}</td>
                <td>{row.startDate}</td>
                <td>{formatMoney(row.amountWithdraw)}</td>
                <td>{formatMoney(row.canWithdraw)}</td>
                <td>{row.degree}</td>
                <td>
                  <button type="button" className="payout-btn payout-btn--purple">Payout Request</button>
                  <button type="button" className="payout-btn payout-btn--dark">Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
