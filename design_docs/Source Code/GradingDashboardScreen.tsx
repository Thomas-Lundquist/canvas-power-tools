import React, { useState } from 'react';
import { INITIAL_GRADING_ITEMS } from '../../data/mockData';
import { GradingItem } from '../../types';
import { AlertCircle, Plus, CheckCircle, Clock, GraduationCap, Download, RefreshCw } from 'lucide-react';

export const GradingDashboardScreen: React.FC = () => {
  const [gradingItems, setGradingItems] = useState<GradingItem[]>(INITIAL_GRADING_ITEMS);
  const [zeroMissingNotice, setZeroMissingNotice] = useState(false);

  const handleGradeMissingAsZero = () => {
    setGradingItems(
      gradingItems.map((item) => ({
        ...item,
        graded: item.submitted,
        missing: 0
      }))
    );
    setZeroMissingNotice(true);
    setTimeout(() => setZeroMissingNotice(false), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn relative pb-20">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1B1C1A] pb-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-[#1B1C1A] tracking-tight uppercase">
            GRADING DASHBOARD
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Track evaluation metrics and submission queues for active assessments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-white border border-[#1B1C1A] text-xs font-bold uppercase rounded-[2px] hover:bg-[#EFEEEA] flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT GRADES</span>
          </button>
          <button
            onClick={handleGradeMissingAsZero}
            className="px-4 py-1.5 bg-[#059669] text-white border border-[#1B1C1A] text-xs font-bold uppercase tracking-wider rounded-[2px] hover:bg-[#047857] flex items-center gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>SYNC CANVAS SPEEDGRADER</span>
          </button>
        </div>
      </div>

      {zeroMissingNotice && (
        <div className="bg-[#059669] text-white p-3 border border-[#1B1C1A] text-xs font-bold rounded-[2px] flex items-center justify-between">
          <span>ALL MISSING SUBMISSIONS SET TO ZERO (0) POINTS.</span>
          <button onClick={() => setZeroMissingNotice(false)} className="underline">Dismiss</button>
        </div>
      )}

      {/* 4 Stat Metric Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-[#1B1C1A] border-t-4 border-t-[#059669] p-4 rounded-[2px]">
          <div className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">
            GRADED
          </div>
          <div className="text-3xl font-black text-[#1B1C1A] mt-1">312</div>
          <div className="text-xs text-gray-500 mt-1">92% completion rate</div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-[#1B1C1A] border-t-4 border-t-[#2563EB] p-4 rounded-[2px]">
          <div className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">
            SUBMITTED
          </div>
          <div className="text-3xl font-black text-[#1B1C1A] mt-1">371</div>
          <div className="text-xs text-gray-500 mt-1">Queue pending evaluation</div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-[#1B1C1A] border-t-4 border-t-[#B7102A] p-4 rounded-[2px] relative overflow-hidden">
          <div className="text-xs font-mono font-bold text-[#B7102A] uppercase tracking-widest flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>MISSING</span>
          </div>
          <div className="text-3xl font-black text-[#B7102A] mt-1">12</div>
          <span className="inline-block px-1.5 py-0.5 bg-[#B7102A] text-white text-xs font-bold uppercase mt-1">
            ! NEEDS REVIEW
          </span>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-[#1B1C1A] border-t-4 border-t-[#7A5500] p-4 rounded-[2px]">
          <div className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest">
            DUE SOON
          </div>
          <div className="text-3xl font-black text-[#1B1C1A] mt-1">03</div>
          <div className="text-xs text-gray-500 mt-1">Within next 48 hours</div>
        </div>
      </div>

      {/* Main Grading Table */}
      <div className="bg-white border border-[#1B1C1A] rounded-[2px] overflow-hidden">
        <div className="bg-[#EFEEEA] border-b border-[#1B1C1A] px-4 py-2.5 flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#1B1C1A] uppercase tracking-wider">
            Active Assignment Evaluations
          </h3>
          <span className="text-xs font-mono text-gray-600 font-bold">
            COURSE: CS101
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1B1C1A] text-xs font-bold text-gray-600 uppercase tracking-wider bg-[#FAF9F5]">
                <th className="py-2.5 px-4 border-r border-[#1B1C1A]">ASSIGNMENT</th>
                <th className="py-2.5 px-4 border-r border-[#1B1C1A] text-center">GRADED</th>
                <th className="py-2.5 px-4 border-r border-[#1B1C1A] text-center">SUBMITTED</th>
                <th className="py-2.5 px-4 border-r border-[#1B1C1A] text-center">MISSING</th>
                <th className="py-2.5 px-4 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B1C1A] text-xs">
              {gradingItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#FAF9F5] transition-colors">
                  <td className="py-3 px-4 font-bold text-[#1B1C1A] border-r border-[#1B1C1A]">
                    {item.assignment}
                  </td>

                  <td className="py-3 px-4 text-center font-mono font-bold text-[#059669] border-r border-[#1B1C1A]">
                    {item.graded}
                  </td>

                  <td className="py-3 px-4 text-center font-mono font-bold text-[#2563EB] border-r border-[#1B1C1A]">
                    {item.submitted}
                  </td>

                  <td className="py-3 px-4 text-center font-mono font-bold text-[#B7102A] border-r border-[#1B1C1A]">
                    {item.missing}
                  </td>

                  <td className="py-3 px-4 text-center font-mono text-xs">
                    <span className="px-2 py-0.5 bg-[#FAF9F5] border border-[#1B1C1A] rounded-[2px] font-bold">
                      {item.due}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Quick Action Button (FAB) */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={handleGradeMissingAsZero}
          className="bg-[#B7102A] text-white border-2 border-[#1B1C1A] px-4 py-3 rounded-[2px] font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-none hover:bg-[#990d23] transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>GRADE MISSING AS ZERO</span>
        </button>
      </div>
    </div>
  );
};
