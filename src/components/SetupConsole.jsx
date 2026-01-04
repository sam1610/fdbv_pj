import React, { useState, useEffect } from 'react';
import { client } from '../DataHook/amplifyClient';
import AgentsView from './AgentsView'; // ✅ Reusing your agent management logic

const TABS = ['Restaurant', 'Branches', 'Items', 'Agents', 'ⓘ'];
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
                            activeTab === tab 
                            ? (tab === 'ⓘ' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-sky-600 text-white shadow-lg') 
                            : 'text-slate-400 hover:bg-slate-700'
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
                {activeTab === 'ⓘ' && <PrivacyPolicySection />}
            </div>
        </div>
    );
}

// --- SUB-SECTION: RESTAURANT ---

const RestaurantSection = ({ pk }) => {
    const [name, setName] = useState('');
    const [coords, setCoords] = useState({ lat: '', lng: '' });
    const [coordError, setCoordError] = useState("");
    const [saving, setSaving] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false); // 🛡️ LOCK GUARD

    // 1️⃣ 🔄 FETCH DATA ONCE
    useEffect(() => {
        const fetchInitialData = async () => {
            if (hasLoaded) return; // Stop if we already loaded once
            
            try {
                const { data } = await client.models.BusinessData.get({ pk, sk: 'CONFIG' });
                if (data) {
                    setName(data.name || '');
                    if (data.location) {
                        setCoords({ 
                            lat: data.location.latitude?.toString() || '', 
                            lng: data.location.longitude?.toString() || '' 
                        });
                    }
                }
                setHasLoaded(true); // ✅ Mark as loaded so we don't overwrite user typing
            } catch (err) {
                console.error("Fetch error:", err);
            }
        };
        fetchInitialData();
    }, [pk, hasLoaded]); // Added hasLoaded to dependency array

    const handleCoordChange = (field, value) => {
        const isFloat = /^-?[0-9]*\.?[0-9]*$/.test(value);
        if (isFloat || value === "") {
            setCoordError("");
            setCoords(prev => ({ ...prev, [field]: value }));
        } else {
            setCoordError("Invalid numeric format");
        }
    };

    const handleUpdate = async () => {
        if (!name.trim()) return alert("Name is required");
        setSaving(true);
        try {
            await client.models.BusinessData.update({
                pk: pk,
                sk: "CONFIG", 
                name: name.trim(),
                entityType: 'Business',
                location: {
                    latitude: parseFloat(coords.lat),
                    longitude: parseFloat(coords.lng)
                }
            });
            alert("✅ Successfully updated in Cloud!");
        } catch (err) {
            console.error("Update Error:", err);
            alert(`Failed: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-sm mx-auto pt-4">
            <header className="border-l-4 border-sky-500 pl-3">
                <h2 className="text-sky-400 font-bold uppercase text-xs tracking-widest">Restaurant Identity</h2>
                <p className="text-[10px] text-slate-500 font-medium italic">Managing: {pk}</p>
            </header>

            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Business Name</label>
                    <input 
                        className="w-full bg-slate-800 p-4 rounded-xl text-white border border-slate-700 focus:ring-2 ring-sky-500 outline-none" 
                        value={name}
                        onChange={e => setName(e.target.value)} 
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">GPS Location (Float)</label>
                    <div className="flex gap-2">
                        <input 
                            className={`flex-1 bg-slate-800 p-4 rounded-xl text-white text-sm border outline-none ${coordError ? 'border-red-500' : 'border-slate-700'}`}
                            placeholder="Lat"
                            value={coords.lat}
                            onChange={e => handleCoordChange('lat', e.target.value)}
                        />
                        <input 
                            className={`flex-1 bg-slate-800 p-4 rounded-xl text-white text-sm border outline-none ${coordError ? 'border-red-500' : 'border-slate-700'}`}
                            placeholder="Lng"
                            value={coords.lng}
                            onChange={e => handleCoordChange('lng', e.target.value)}
                        />
                    </div>
                </div>

                <button 
                    onClick={() => {
                        navigator.geolocation.getCurrentPosition(pos => {
                            setCoords({ 
                                lat: pos.coords.latitude.toString(), 
                                lng: pos.coords.longitude.toString() 
                            });
                        });
                    }} 
                    className="w-full text-indigo-400 text-[10px] font-black py-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20"
                >
                    📍 CAPTURE GPS
                </button>

                <button 
                    onClick={handleUpdate} 
                    disabled={saving || !!coordError}
                    className="w-full bg-sky-600 py-4 rounded-xl font-black text-white shadow-lg active:scale-95 disabled:opacity-50"
                >
                    {saving ? "SYNCING..." : "COMMIT CHANGES"}
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

// --- 🆕 SUB-SECTION: PRIVACY POLICY ---
const PrivacyPolicySection = () => {
    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in text-slate-300 pt-2">
            <header className="border-l-4 border-emerald-500 pl-4 mb-6">
                <h2 className="text-2xl font-bold text-white">Privacy Policy</h2>
                <p className="text-xs text-emerald-400 mt-1 uppercase tracking-widest">Effective Date: January 4, 2026</p>
            </header>

            <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 space-y-8 shadow-xl text-sm leading-relaxed">
                
                {/* 1. Introduction */}
                <section>
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">1. Introduction</h3>
                    <p>
                        Welcome to <strong className="text-white">CloudOrder</strong> (operated by <strong>1st-Hub</strong>). We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our services, including our web dashboard and our WhatsApp-based ordering system.
                    </p>
                    <p className="mt-2">By using our services, you agree to the collection and use of information in accordance with this policy.</p>
                </section>

                {/* 2. Information We Collect */}
                <section>
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">2. Information We Collect</h3>
                    <p className="mb-2">We collect information to provide and improve our services. The types of data collected include:</p>
                    
                    <div className="pl-4 border-l-2 border-slate-600 space-y-3">
                        <div>
                            <h4 className="text-emerald-400 font-bold text-xs uppercase">A. Information You Provide to Us</h4>
                            <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-400">
                                <li><strong>Merchants:</strong> Business Name, Address, Contact Details, Menu data.</li>
                                <li><strong>End-Users (WhatsApp):</strong> Phone Number, Profile Name, Location Data (GPS for delivery), Order Details.</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-emerald-400 font-bold text-xs uppercase">B. Information Collected Automatically</h4>
                            <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-400">
                                <li><strong>Log Data:</strong> IP addresses, browser type, access times.</li>
                                <li><strong>Usage Data:</strong> Interactions with WhatsApp bot (flows, clicks).</li>
                                <li><strong>Meta Platform Data:</strong> Technical identifiers for routing messages.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* 3. Usage */}
                <section>
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">3. How We Use Your Information</h3>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Service Delivery:</strong> Processing orders and routing to restaurant branches.</li>
                        <li><strong>Communication:</strong> Sending confirmations and delivery updates via WhatsApp.</li>
                        <li><strong>Location Services:</strong> Calculating fees and guiding delivery agents.</li>
                        <li><strong>Compliance:</strong> Adhering to legal obligations and Meta’s Terms.</li>
                    </ul>
                </section>

                {/* 4. Sharing */}
                <section>
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">4. Data Sharing & Third Parties</h3>
                    <p>We do not sell your personal data. We share data only with necessary providers:</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li><strong>Meta Platforms (WhatsApp):</strong> For message exchange.</li>
                        <li><strong>AWS:</strong> For secure cloud hosting and storage.</li>
                        <li><strong>Restaurant Partners:</strong> Order details shared strictly for fulfillment.</li>
                    </ul>
                </section>

                {/* 5. Retention & Deletion */}
                <section>
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">5. Data Retention & Deletion</h3>
                    <p>We retain data only as long as necessary. In compliance with PDPL and Meta’s Policy:</p>
                    <div className="bg-slate-900/50 p-4 rounded-lg mt-3 border border-slate-600">
                        <h4 className="text-white font-bold text-xs uppercase mb-1">Requesting Data Deletion</h4>
                        <p className="text-xs text-slate-400 mb-1">
                            Send an email to <span className="text-emerald-400">info@1st-hub.com</span> with the subject "Data Deletion Request" and your phone number.
                        </p>
                        <p className="text-xs text-slate-400">
                            We process valid requests within <strong>30 days</strong>.
                        </p>
                    </div>
                </section>

                {/* 6. Security */}
                <section>
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">6. Security</h3>
                    <p>We implement industry-standard security measures including encryption in transit (TLS/SSL) and strict IAM access controls.</p>
                </section>

                {/* 9. Contact */}
                <section>
                    <h3 className="text-white font-bold text-base mb-2 border-b border-slate-700 pb-2">9. Contact Us</h3>
                    <div className="text-slate-400 text-xs space-y-1">
                        <p>Email: <a href="mailto:info@1st-hub.com" className="text-sky-400 hover:underline">info@1st-hub.com</a></p>
                        <p>Website: <a href="https://1st-hub.com" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">https://1st-hub.com</a></p>
                        <p>Address: Manama, Bahrain</p>
                    </div>
                </section>
            </div>
            
            <div className="text-center pt-6 pb-4">
                <p className="text-xs text-slate-500">© 2026 1st-Hub. All rights reserved.</p>
            </div>
        </div>
    );
};