// DashboardView.jsx
import React from 'react';
import LiveKPIs from './LiveKPIs';

const DashboardView = ({ phoneNbr, filterDays = 1, setModal }) => {
  return (
    <div className="p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Good Morning!</h1>
        <p className="text-slate-400">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      {/* KPIs + Chart – only this block re-renders */}
      <LiveKPIs phoneNbr={phoneNbr} filterDays={filterDays} setModal={setModal} />
    </div>
  );
};

export default DashboardView;