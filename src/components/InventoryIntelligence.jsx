import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/data'; // 1. Import Client
import { useAIGeneration } from '../DataHook/amplifyClient'; 
import { Sparkles, TrendingUp, Loader2 } from 'lucide-react';

const client = generateClient();

// Match your Enum exactly
const CATEGORIES = [
    'STARTERS', 'MAIN_COURSE', 'BREAKFAST', 'LUNCH_SPECIALS',
    'SALADS', 'SOUPS', 'SANDWICHES_WRAPS', 'PIZZA_PASTA',
    'SIDES', 'SAUCES_EXTRAS',
    'DRINKS_COLD', 'DRINKS_HOT', 'SMOOTHIES_SHAKES',
    'DESSERTS', 'KIDS_MEAL', 'BUNDLES_DEALS', 'HEALTHY_DIET'
];

// ✅ REMOVED: "orders" prop. This component is now self-sufficient.
export const InventoryIntelligence = () => {
  const [selectedCategory, setSelectedCategory] = useState('MAIN_COURSE');
  const [timeSegment, setTimeSegment] = useState('All Day');
  
  // State to track the fetching of history before prediction
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  const [{ data, isLoading: isAiLoading, hasError, error }, predictInventory] = useAIGeneration("predictInventory");

  const handlePredict = async () => {
    setIsFetchingHistory(true);

    try {
        // 1. Calculate the date range (e.g., last 30 days)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const dateStr = cutoffDate.toISOString();

        // ✅ 2. QUERY THE NEW INDEX
        // instead of scanning all orders, we ask DynamoDB:
        // "Give me only MAIN_COURSE items ordered after Nov 9th"
        const { data: salesHistory, errors } = await client.models.BusinessData.listByCategory({
            itemCategory: selectedCategory,
            orderDate: { ge: dateStr }
        });

        if (errors) throw new Error("Could not fetch sales history");

        if (salesHistory.length === 0) {
            alert(`No sales history found for ${selectedCategory}.`);
            setIsFetchingHistory(false);
            return;
        }

        // 3. Format data for the AI (Aggregate raw rows into daily totals)
        // We accumulate quantities by date
        const counts = {};
        salesHistory.forEach(item => {
            const dateKey = item.orderDate.split('T')[0];
            // Handle both singular 'quantity' and potential duplicates
            counts[dateKey] = (counts[dateKey] || 0) + (item.quantity || 1);
        });

        const historySummary = Object.entries(counts)
            .map(([date, qty]) => ({ date, qty }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        console.log(`Sending ${historySummary.length} days of history to AI`);

        // 4. Call the AI
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        predictInventory({
            targetDate: tomorrow.toISOString().split('T')[0],
            category: selectedCategory,
            timeSegment: timeSegment,
            historySummary: JSON.stringify(historySummary)
        });

    } catch (err) {
        console.error("Prediction Flow Error:", err);
        alert("Failed to prepare data for prediction.");
    } finally {
        setIsFetchingHistory(false);
    }
  };

  const isLoading = isAiLoading || isFetchingHistory;

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl mt-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-700 pb-4">
        <Sparkles className="text-purple-400 w-6 h-6" />
        <h2 className="text-xl font-bold text-white">AI Demand Forecast</h2>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Category</label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-slate-700 text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500 border border-slate-600"
          >
            {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Time Block</label>
          <div className="flex bg-slate-700 rounded-lg p-1 border border-slate-600">
            {['All Day', 'Lunch', 'Dinner'].map(seg => (
              <button
                key={seg}
                onClick={() => setTimeSegment(seg)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  timeSegment === seg ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {seg}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end">
          <button 
            onClick={handlePredict}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin"/> : <><TrendingUp size={18}/> Predict</>}
          </button>
        </div>
      </div>

      {/* Results */}
      {hasError && <div className="text-red-400 bg-red-900/20 p-4 rounded mb-4">{error?.message || "Unknown error"}</div>}
      
      {data && (
        <div className="bg-slate-900/50 p-5 rounded-lg border border-purple-500/30">
          <div className="flex justify-between items-center mb-4">
            <div>
                <div className="text-4xl font-black text-white">{data.predictedQuantity} <span className="text-lg text-slate-500 font-normal">items</span></div>
            </div>
            <span className="px-3 py-1 bg-slate-700 rounded text-xs font-bold border border-slate-600">{data.confidence} CONFIDENCE</span>
          </div>
          <p className="text-slate-300 text-sm">{data.reasoning}</p>
        </div>
      )}
    </div>
  );
};