import React, { useState } from 'react';
import { client } from '../DataHook/amplifyClient';
import AgentsView from './AgentsView'; // ✅ Reusing your agent management logic

const TABS = ['Restaurant', 'Branches', 'Items', 'Agents'];
const ITEM_CATEGORIES = [
    'STARTERS', 'MAIN_COURSE', 'BREAKFAST', 'FASTFOOD', 'LUNCH_SPECIALS',
    'SALADS', 'SOUPS', 'SANDWICHES_WRAPS', 'PIZZA_PASTA', 'SIDES',
    'SAUCES_EXTRAS', 'DRINKS_COLD', 'DRINKS_HOT', 'SMOOTHIES_SHAKES',
    'DESSERTS', 'KIDS_MEAL', 'BUNDLES_DEALS', 'HEALTHY_DIET'
];

export default function SetupConsole({ phoneNbr, onDataChange, businessLocation, setModal }) {
    const [activeTab, setActiveTab] = useState('Restaurant');
    const businessPk = `BUSINESS#${phoneNbr}`;

    return (
        <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
            {/* --- 4-Button Header Navigation --- */}
            <div className="flex bg-slate-800 p-2 border-b border-slate-700">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 px-2 rounded-xl text-[13px] font-black uppercase tracking-tighter transition-all ${
                            activeTab === tab ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'
                        }`}>
                        {tab}
                    </button>
                ))}
            </div>

            {/* --- Content Area --- */}
            <div className="flex-grow overflow-y-auto p-4 pb-24">
                {activeTab === 'Restaurant' && <RestaurantSection pk={businessPk} currentLoc={businessLocation} />}
                
                {activeTab === 'Branches' && <BranchesSection pk={businessPk} />}
                
                {activeTab === 'Items' && <ItemsSection pk={businessPk} onUpdate={onDataChange} />}

                {activeTab === 'Agents' && (
                    <div className="animate-fade-in">
                        {/* ✅ Renders your existing Agent List and Add Agent logic */}
                        <AgentsView 
                            phoneNbr={phoneNbr} 
                            setModal={setModal} 
                            onAgentAdded={onDataChange} 
                            businessLocation={businessLocation} 
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// --- SUB-SECTION: RESTAURANT ---
const RestaurantSection = ({ pk, currentLoc }) => {
    const [name, setName] = useState('');
    const [coords, setCoords] = useState({ 
        lat: currentLoc?.latitude || '', 
        lng: currentLoc?.longitude || '' 
    });
    const [coordError, setCoordError] = useState("");
    const [saving, setSaving] = useState(false);

    // ✅ Robust Float Validation Logic
    const handleCoordChange = (field, value) => {
        // Regex allows: negative signs, numbers, and a single decimal point
        const isFloat = /^-?[0-9]*\.?[0-9]*$/.test(value);
        
        if (isFloat || value === "") {
            setCoordError("");
            setCoords(prev => ({ ...prev, [field]: value }));
        } else {
            setCoordError("Coordinates must be valid numbers (e.g. 26.123)");
        }
    };

    const handleUpdate = async () => {
        if (!name) return alert("Please enter a Restaurant Name");
        if (!coords.lat || !coords.lng) return alert("Coordinates are required");
        
        setSaving(true);
        try {
            await client.models.BusinessData.update({
                pk: pk,
                sk: "CONFIG", 
                name: name,
                entityType: 'Business',
                location: {
                    // Convert string input back to Float for DynamoDB
                    latitude: parseFloat(coords.lat),
                    longitude: parseFloat(coords.lng)
                }
            });
            alert("Restaurant CONFIG updated successfully!");
        } catch (err) {
            console.error("Update Error:", err);
            alert("Failed to update config.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-sm mx-auto pt-4">
            <header>
                <h2 className="text-sky-400 font-bold uppercase text-xs tracking-widest">Restaurant Identity</h2>
                <p className="text-[10px] text-slate-500 font-medium italic">Updating: CONFIG record</p>
            </header>

            <div className="space-y-4">
                {/* Name Field */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Business Name</label>
                    <input 
                        className="w-full bg-slate-800 p-4 rounded-xl text-white border border-slate-700 focus:ring-2 ring-sky-500 outline-none" 
                        placeholder="e.g. Al-Mahrez Kitchen" 
                        value={name}
                        onChange={e => setName(e.target.value)} 
                    />
                </div>

                {/* Editable Coordinates Group */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">GPS Coordinates (Float)</label>
                    <div className="flex gap-2">
                        <input 
                            className={`flex-1 bg-slate-800 p-4 rounded-xl text-white text-sm border transition-all outline-none ${coordError ? 'border-red-500' : 'border-slate-700'}`}
                            type="text"
                            placeholder="Latitude"
                            value={coords.lat}
                            onChange={e => handleCoordChange('lat', e.target.value)}
                        />
                        <input 
                            className={`flex-1 bg-slate-800 p-4 rounded-xl text-white text-sm border transition-all outline-none ${coordError ? 'border-red-500' : 'border-slate-700'}`}
                            type="text"
                            placeholder="Longitude"
                            value={coords.lng}
                            onChange={e => handleCoordChange('lng', e.target.value)}
                        />
                    </div>
                    {coordError && <p className="text-[10px] text-red-400 font-bold ml-1 animate-pulse">{coordError}</p>}
                </div>

                <button 
                    onClick={() => {
                        navigator.geolocation.getCurrentPosition(pos => {
                            setCoords({ lat: pos.coords.latitude.toString(), lng: pos.coords.longitude.toString() });
                            setCoordError("");
                        });
                    }} 
                    className="w-full text-indigo-400 text-[10px] font-black py-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 flex items-center justify-center gap-2"
                >
                    📍 AUTO-DETECT LOCATION
                </button>

                <button 
                    onClick={handleUpdate} 
                    disabled={saving || !!coordError}
                    className="w-full bg-sky-600 py-4 rounded-xl font-black text-white shadow-lg hover:bg-sky-500 active:scale-95 transition-all disabled:opacity-50"
                >
                    {saving ? "SYNCING..." : "SUBMIT UPDATES"}
                </button>
            </div>
        </div>
    );
};

// --- SUB-SECTION: ITEMS ---
const ItemsSection = ({ pk, onUpdate }) => {
    const [item, setItem] = useState({ 
        name: '', 
        category: 'MAIN_COURSE', 
        price: '',
        description: '' 
    });
    const [saving, setSaving] = useState(false);
    const [priceError, setPriceError] = useState("");

    const submit = async () => {
        if (!item.name || !item.price) return alert("Please enter name and price");
        
        setSaving(true);
        try {
            // 1️⃣ Step 1: Query existing items to determine the next ID
            const { data: existingItems } = await client.models.BusinessData.listByBusiness({
                pk: pk,
                sk: { beginsWith: 'ITEM#' }
            });

            // 2️⃣ Step 2: Calculate the new number (e.g., 5 items exist -> next is 6)
            const nextNumber = existingItems.length + 1;
            
            // 3️⃣ Step 3: Format as ITEM#00X (e.g., ITEM#006)
            const formattedId = `ITEM#${String(nextNumber).padStart(3, '0')}`;
            
            console.log(`Creating item with sequenced ID: ${formattedId}`);

            // 4️⃣ Step 4: Create the record
            await client.models.BusinessData.create({
                pk, 
                sk: formattedId,
                name: item.name,
                unitPrice: parseFloat(item.price),
                itemCategory: item.category,
                description: item.description,
                stockStatus: 'IN_STOCK',
                entityType: 'Product'
            });
            
            if (onUpdate) onUpdate(); 
            alert(`Success! ${item.name} saved as ${formattedId}`);
            
            // Reset form
            setItem({ name: '', category: 'MAIN_COURSE', price: '', description: '' });
        } catch (err) {
            console.error("Error adding sequenced item:", err);
            alert("Error: Could not determine next item ID.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 max-w-sm mx-auto pt-4">
            <h2 className="text-indigo-400 font-bold uppercase text-xs tracking-widest">Add Item ({pk})</h2>
            
            <input 
                className="w-full bg-slate-800 p-4 rounded-xl text-white border border-slate-700" 
                placeholder="Meal Name" 
                value={item.name}
                onChange={e => setItem({...item, name: e.target.value})} 
            />
            <textarea 
                className="w-full bg-slate-800 p-4 rounded-xl text-white border border-slate-700 text-sm h-24 focus:ring-2 ring-indigo-500 outline-none resize-none" 
                placeholder="Brief Description (e.g., 200g Beef, Cheddar, Special Sauce...)" 
                value={item.description}
                onChange={e => setItem({...item, description: e.target.value})} 
            />

            <div className="flex gap-2">
    <div className="flex flex-col flex-1 gap-1">
    <input 
        className={`w-full bg-slate-800 p-4 rounded-xl text-white border transition-all outline-none ${
            priceError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-700 focus:ring-2 ring-indigo-500'
        }`}
        type="text" // Use text to allow manual validation of the string
        placeholder="Price (BD)" 
        value={item.price}
        onChange={e => {
            const val = e.target.value;
            
            // 1. Allow empty input (user deleting)
            if (val === "") {
                setPriceError("");
                setItem({ ...item, price: "" });
                return;
            }

            // 2. Regex check: Is it a valid positive number/decimal?
            const isNumeric = /^[0-9]*\.?[0-9]*$/.test(val);

            if (!isNumeric) {
                setPriceError("Please enter numbers only");
            } else {
                setPriceError("");
                setItem({ ...item, price: val });
            }
        }} 
    />
    {/* ⚠️ Warning Message under the field */}
    {priceError && (
        <span className="text-[10px] text-red-400 font-bold ml-2 animate-pulse">
            {priceError}
        </span>
    )}
</div>
                
                <select 
                    className="flex-1 bg-slate-800 p-4 rounded-xl text-white border border-slate-700 text-xs font-bold"
                    value={item.category}
                    onChange={e => setItem({...item, category: e.target.value})}
                >
                    {ITEM_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                            {cat.replace(/_/g, ' ')}
                        </option>
                    ))}
                </select>
            </div>

            <button 
                onClick={submit} 
                disabled={saving}
                className="w-full bg-indigo-600 py-4 rounded-xl font-bold text-white mt-6 shadow-lg shadow-indigo-900/20 disabled:opacity-50 transition active:scale-95"
            >
                {saving ? "CALCULATING ID..." : "SUBMIT TO MENU"}
            </button>
        </div>
    );
};
// --- SUB-SECTION: BRANCHES ---
const BranchesSection = ({ pk }) => {
    const [branchName, setBranchName] = useState('');
    const [coords, setCoords] = useState({ lat: '', lng: '' });
    const [coordError, setCoordError] = useState("");
    const [saving, setSaving] = useState(false);

    // ✅ Coordinate Validation (Float)
    const handleCoordChange = (field, value) => {
        const isFloat = /^-?[0-9]*\.?[0-9]*$/.test(value);
        if (isFloat || value === "") {
            setCoordError("");
            setCoords(prev => ({ ...prev, [field]: value }));
        } else {
            setCoordError("Coordinates must be numeric (e.g. 26.123)");
        }
    };

    const handleCreateBranch = async () => {
        if (!branchName) return alert("Please enter a Branch Name");
        if (!coords.lat || !coords.lng) return alert("Branch coordinates are required");
        
        setSaving(true);
        try {
            // 1️⃣ STEP 1: Query existing branches to count them
            // This ensures we get the correct increment for BRANCH#XXX
            const { data: existingBranches } = await client.models.BusinessData.listByBusiness({
                pk: pk,
                sk: { beginsWith: 'BRANCH#' }
            });

            // 2️⃣ STEP 2: Determine next ID (e.g., 2 branches exist -> next is 003)
            const nextIndex = existingBranches.length + 1;
            const branchId = `BRANCH#${String(nextIndex).padStart(3, '0')}`;

            // 3️⃣ STEP 3: Create the record with required attributes
            await client.models.BusinessData.create({
                pk: pk,                  // BUSINESS#+phone
                sk: branchId,            // BRANCH#001...
                name: branchName,
                entityType: 'Branch',
                location: {
                    latitude: parseFloat(coords.lat),
                    longitude: parseFloat(coords.lng)
                }
            });

            alert(`Branch ${branchName} successfully registered as ${branchId}`);
            
            // Reset Form
            setBranchName('');
            setCoords({ lat: '', lng: '' });
        } catch (err) {
            console.error("Branch Sequencing Error:", err);
            alert("Failed to save branch. Please check connection.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-sm mx-auto pt-4">
            <header className="border-l-4 border-emerald-500 pl-3">
                <h2 className="text-emerald-400 font-bold uppercase text-xs tracking-widest">Branch Registration</h2>
                <p className="text-[10px] text-slate-500 font-medium italic">Assigning sequence for {pk}</p>
            </header>

            <div className="space-y-5">
                {/* Branch Name */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Branch Name / Area</label>
                    <input 
                        className="w-full bg-slate-800 p-4 rounded-xl text-white border border-slate-700 focus:ring-2 ring-emerald-500 outline-none transition-all" 
                        placeholder="e.g. Seef Mall Branch" 
                        value={branchName}
                        onChange={e => setBranchName(e.target.value)} 
                    />
                </div>

                {/* Editable Float Coordinates */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Dispatch Coordinates (Float)</label>
                    <div className="flex gap-2">
                        <input 
                            className={`flex-1 bg-slate-800 p-4 rounded-xl text-white text-sm border transition-all outline-none ${coordError ? 'border-red-500' : 'border-slate-700 focus:border-emerald-500'}`}
                            placeholder="Latitude"
                            value={coords.lat}
                            onChange={e => handleCoordChange('lat', e.target.value)}
                        />
                        <input 
                            className={`flex-1 bg-slate-800 p-4 rounded-xl text-white text-sm border transition-all outline-none ${coordError ? 'border-red-500' : 'border-slate-700 focus:border-emerald-500'}`}
                            placeholder="Longitude"
                            value={coords.lng}
                            onChange={e => handleCoordChange('lng', e.target.value)}
                        />
                    </div>
                    {coordError && <p className="text-[9px] text-red-400 font-bold ml-1 italic">{coordError}</p>}
                </div>

                {/* Detect Location Button */}
                <button 
                    onClick={() => {
                        navigator.geolocation.getCurrentPosition(pos => {
                            setCoords({ 
                                lat: pos.coords.latitude.toString(), 
                                lng: pos.coords.longitude.toString() 
                            });
                            setCoordError("");
                        });
                    }} 
                    className="w-full text-emerald-400 text-[10px] font-black py-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all"
                >
                    📍 CAPTURE BRANCH GPS
                </button>

                {/* Submit */}
                <button 
                    onClick={handleCreateBranch} 
                    disabled={saving || !!coordError}
                    className="w-full bg-emerald-600 py-4 rounded-xl font-black text-white shadow-lg hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? "GENERATING BRANCH ID..." : "REGISTER BRANCH"}
                </button>
            </div>
        </div>
    );
};