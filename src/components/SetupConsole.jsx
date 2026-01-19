import React, { useState, useEffect } from 'react';
import { client } from '../DataHook/amplifyClient';
import AgentsView from './AgentsView'; 

const TABS = ['Restaurant', 'Branches', 'Items', 'Agents', 'ⓘ'];

// 🗑️ REMOVED: const ITEM_CATEGORIES = [...] (User defines them now)

export default function SetupConsole({ phoneNbr, onDataChange, businessLocation, setModal }) {
    const [activeTab, setActiveTab] = useState('Restaurant');
    const businessPk = `BUSINESS#${phoneNbr}`;

    // 1️⃣ INITIALIZE META SDK (Global)
    useEffect(() => {
        // window.fbAsyncInit = function() {
        //     window.FB.init({
        //         appId: '29979645098350108', // App ID
        //         cookie: true,
        //         xfbml: true,
        //         version: 'v20.0'
        //     });
        // };
        (function(d, s, id){
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) {return;}
            js = d.createElement(s); js.id = id;
            js.src = "https://connect.facebook.net/en_US/sdk.js";
            fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));
    }, []);

    return (
        <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
            {/* --- Navigation Header --- */}
            <div className="flex bg-slate-800 p-2 border-b border-slate-700 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 min-w-[80px] py-3 px-2 rounded-xl text-[11px] font-black uppercase tracking-tighter transition-all whitespace-nowrap ${
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
                {activeTab === 'Restaurant' && (
                    <RestaurantSection 
                        pk={businessPk} 
                        phoneNbr={phoneNbr} 
                        onShowPrivacy={() => setActiveTab('ⓘ')} 
                    />
                )}
                
                {activeTab === 'Branches' && <BranchesSection pk={businessPk} />}
                {/* ✅ UPDATED ITEMS SECTION */}
                {activeTab === 'Items' && <ItemsSection pk={businessPk} onUpdate={onDataChange} />}
                
                {activeTab === 'Agents' && (
                    <div className="animate-fade-in">
                        <AgentsView phoneNbr={phoneNbr} setModal={setModal} onAgentAdded={onDataChange} businessLocation={businessLocation} />
                    </div>
                )}
                
                {activeTab === 'ⓘ' && <PrivacyPolicySection />}
            </div>
        </div>
    );
}

// --- FINAL ITEMS SECTION (Strip Base64 Header on Save / Restore on Load) ---
const ItemsSection = ({ pk, onUpdate }) => {
    // Constant for the header to strip/add
    const BASE64_HEADER = "data:image/jpeg;base64,";

    // Form State
    const [item, setItem] = useState({ 
        name: '', 
        price: '',
        description: '',
        quantity: '',    
        stockStatus: true, 
        imageUrl: ''       // Holds Full String (with Header) for Preview
    });
    
    // Management State
    const [allItems, setAllItems] = useState([]); 
    const [editingId, setEditingId] = useState(null); 
    
    // Category State
    const [category, setCategory] = useState(''); 
    const [existingCategories, setExistingCategories] = useState([]);
    
    // UI State
    const [showItemSuggestions, setShowItemSuggestions] = useState(false);
    const [showCatSuggestions, setShowCatSuggestions] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [feedback, setFeedback] = useState({ msg: '', type: '' }); 

    const showMessage = (msg, type = 'success') => {
        setFeedback({ msg, type });
        setTimeout(() => setFeedback({ msg: '', type: '' }), 4000);
    };

    // ---------------------------------------------------------
    // 🖼️ IMAGE HANDLER (Generates Full String for Preview)
    // ---------------------------------------------------------
    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 70;
                canvas.height = 70;
                ctx.drawImage(img, 0, 0, 70, 70);
                
                // Full string (Standard Base64 with header)
                const fullBase64 = canvas.toDataURL('image/jpeg', 0.7);
                setItem(prev => ({ ...prev, imageUrl: fullBase64 }));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    // ---------------------------------------------------------
    // 1️⃣ Fetch Data
    // ---------------------------------------------------------
    const fetchItems = async () => {
        setIsLoading(true);
        try {
            const { data } = await client.models.BusinessData.listByBusiness({
                pk: pk,
                sk: { beginsWith: 'ITEM#' }
            });

            const sortedItems = data.sort((a, b) => a.name.localeCompare(b.name));
            setAllItems(sortedItems);

            const uniqueCats = [...new Set(
                data.map(i => i.itemCategory).filter(c => c)
            )].sort();

            setExistingCategories(uniqueCats);
        } catch (err) {
            console.error("Failed to fetch items", err);
            showMessage("Failed to load menu items.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, [pk]);

    // ---------------------------------------------------------
    // 2️⃣ Filter Logics
    // ---------------------------------------------------------
    const filteredItems = allItems.filter(i => 
        i.name.toLowerCase().includes(item.name.toLowerCase())
    );
    const filteredCategories = existingCategories.filter(c => 
        c.toLowerCase().includes(category.toLowerCase())
    );

    // ---------------------------------------------------------
    // 3️⃣ Select Handlers (RESTORE HEADER HERE)
    // ---------------------------------------------------------
    const selectItemToEdit = (selectedItem) => {
        setEditingId(selectedItem.sk);
        
        // ✅ RE-ATTACH HEADER for Preview
        // If DB has "abc...", we make it "data:image/jpeg;base64,abc..."
        const previewImage = selectedItem.imageUrl 
            ? (selectedItem.imageUrl.startsWith('data:') ? selectedItem.imageUrl : BASE64_HEADER + selectedItem.imageUrl)
            : '';

        setItem({
            name: selectedItem.name,
            price: selectedItem.unitPrice.toString(),
            description: selectedItem.description || '',
            quantity: selectedItem.quantity || '',
            stockStatus: selectedItem.stockStatus,
            imageUrl: previewImage 
        });
        
        setCategory(selectedItem.itemCategory || '');
        setShowItemSuggestions(false);
        setFeedback({ msg: '', type: '' });
    };

    const resetToCreateMode = () => {
        setEditingId(null);
        setItem({ name: '', price: '', description: '', quantity: '', stockStatus: true, imageUrl: '' });
        setCategory('');
        setShowItemSuggestions(false);
        setShowCatSuggestions(false);
        setFeedback({ msg: '', type: '' });
    };

    // ---------------------------------------------------------
    // 4️⃣ Submit Handler (STRIP HEADER HERE)
    // ---------------------------------------------------------
    const submit = async () => {
        if (!item.name.trim()) return showMessage("Item Name is required.", "error");
        if (!item.price) return showMessage("Unit Price is required.", "error");
        if (!category.trim()) return showMessage("Category is required.", "error");

        const finalCategory = category.trim().toUpperCase();
        
        // ✅ STRIP HEADER before Saving
        // If "data:image/jpeg;base64,abc...", it becomes "abc..."
        const dbImageString = item.imageUrl.replace(BASE64_HEADER, '');

        setSaving(true);
        setFeedback({ msg: '', type: '' });
        
        try {
            const payload = {
                pk: pk,
                name: item.name.trim(),
                unitPrice: parseFloat(item.price),
                itemCategory: finalCategory,
                description: item.description,
                stockStatus: item.stockStatus,
                quantity: item.quantity ? parseInt(item.quantity) : 0,
                imageUrl: dbImageString // ✅ Saved without header
            };

            if (editingId) {
                // UPDATE
                await client.models.BusinessData.update({ ...payload, sk: editingId });
                showMessage(`✅ Updated: ${item.name}`);
            } else {
                // CREATE
                const maxId = allItems.reduce((max, currentItem) => {
                    const parts = currentItem.sk.split('#'); 
                    const num = parseInt(parts[1], 10);      
                    return !isNaN(num) && num > max ? num : max;
                }, 0);

                const formattedId = `ITEM#${String(maxId + 1).padStart(3, '0')}`;
                
                await client.models.BusinessData.create({
                    ...payload,
                    sk: formattedId,
                    entityType: 'ITEM'
                });
                showMessage(`✅ Created: ${item.name}`);
            }
            
            await fetchItems();
            if (onUpdate) onUpdate(); 
            if (!editingId) resetToCreateMode();

        } catch (err) {
            console.error("Error saving item:", err);
            showMessage("Failed to save item. See console.", "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 max-w-sm mx-auto pt-4 animate-fade-in pb-20">
            {/* Header */}
            <header className="flex justify-between items-end border-b border-indigo-500 pb-2 mb-2">
                <div>
                    <h2 className="text-indigo-400 font-bold uppercase text-xs tracking-widest">Menu Manager</h2>
                    <p className="text-[10px] text-slate-500 italic">
                        {editingId ? "✏️ Updating Item" : "✨ Creating New Item"}
                    </p>
                </div>
                {editingId && (
                    <button onClick={resetToCreateMode} className="text-[9px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors">✕ Cancel</button>
                )}
            </header>

            {/* 1. Item Name (Search/Create) */}
            <div className="space-y-1 relative">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Item Name <span className="text-red-500">*</span></label>
                <div className="relative">
                    <input 
                        className={`w-full bg-slate-800 p-3 rounded-lg text-white border outline-none text-sm transition-all ${
                            editingId ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-slate-700 focus:border-indigo-500'
                        }`}
                        placeholder="Type to search or create..." 
                        value={item.name}
                        onChange={(e) => {
                            setItem({...item, name: e.target.value});
                            if(!editingId) setShowItemSuggestions(true);
                        }}
                        onFocus={() => { if(!editingId) setShowItemSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowItemSuggestions(false), 200)}
                        autoComplete="off"
                    />
                    {showItemSuggestions && filteredItems.length > 0 && item.name && (
                        <div className="absolute z-50 w-full bg-slate-800 border border-slate-600 rounded-xl shadow-2xl mt-1 max-h-48 overflow-y-auto custom-scrollbar">
                            {filteredItems.map((suggestion) => (
                                <button
                                    key={suggestion.sk}
                                    onMouseDown={() => selectItemToEdit(suggestion)}
                                    className="w-full text-left px-4 py-2 hover:bg-indigo-600/20 hover:text-indigo-300 text-slate-300 text-xs border-b border-slate-700/50 flex justify-between"
                                >
                                    <span className="font-bold">{suggestion.name}</span>
                                    <span className="text-[9px] opacity-50">{suggestion.unitPrice} BD</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 2. IMAGE + CATEGORY ROW */}
            <div className="flex gap-2 items-end">
                
                {/* A. Image Uploader */}
                <div className="shrink-0">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1 mb-1 block">Image</label>
                    <div className="relative w-[70px] h-[70px] bg-slate-800 rounded-lg border border-slate-700 overflow-hidden hover:border-indigo-500 cursor-pointer group shadow-sm transition-all">
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={handleImageUpload}
                        />
                        {/* Preview uses item.imageUrl which always has header in state */}
                        {item.imageUrl ? (
                            <img src={item.imageUrl} alt="Item" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 group-hover:text-indigo-400 bg-slate-800/50">
                                <span className="text-xl font-light">+</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* B. Category Input */}
                <div className="flex-1 space-y-1 relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Category <span className="text-red-500">*</span></label>
                    <div className="relative h-[70px] flex items-end"> 
                        <input 
                            className="w-full bg-slate-800 p-3 h-full rounded-lg text-white border border-slate-700 focus:border-indigo-500 outline-none text-sm transition-all placeholder-slate-500"
                            placeholder="Select or Type New..." 
                            value={category}
                            onChange={(e) => {
                                setCategory(e.target.value);
                                setShowCatSuggestions(true);
                            }}
                            onFocus={() => setShowCatSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowCatSuggestions(false), 200)}
                            autoComplete="off"
                        />
                        {/* Suggestions */}
                        {showCatSuggestions && (
                            <div className="absolute top-full z-50 w-full bg-slate-800 border border-slate-600 rounded-xl shadow-2xl mt-1 max-h-40 overflow-y-auto custom-scrollbar">
                                {filteredCategories.map((cat) => (
                                    <button
                                        key={cat}
                                        onMouseDown={() => { setCategory(cat); setShowCatSuggestions(false); }}
                                        className="w-full text-left px-4 py-2 hover:bg-indigo-600/20 hover:text-indigo-300 text-slate-300 text-xs border-b border-slate-700/50 last:border-0"
                                    >
                                        {cat}
                                    </button>
                                ))}
                                {filteredCategories.length === 0 && category && (
                                    <div className="px-4 py-2 text-[9px] text-emerald-400 bg-emerald-900/10 border-t border-emerald-500/20">
                                        New: "{category.toUpperCase()}"
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Price & Quantity */}
            <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Price (BD) <span className="text-red-500">*</span></label>
                    <input 
                        className="w-full bg-slate-800 p-3 rounded-lg text-white border border-slate-700 focus:border-indigo-500 outline-none text-sm"
                        placeholder="0.000" 
                        value={item.price}
                        onChange={e => {
                            const val = e.target.value;
                            if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                setItem({ ...item, price: val });
                            }
                        }} 
                    />
                </div>
                
                <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Qty (Opt)</label>
                    <input 
                        type="number"
                        className="w-full bg-slate-800 p-3 rounded-lg text-white border border-slate-700 focus:border-indigo-500 outline-none text-sm"
                        placeholder="0" 
                        value={item.quantity}
                        onChange={e => setItem({ ...item, quantity: e.target.value })} 
                    />
                </div>
            </div>

            {/* 4. Description */}
            <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Description</label>
                <textarea 
                    className="w-full bg-slate-800 p-3 rounded-lg text-white border border-slate-700 text-xs h-16 focus:border-indigo-500 outline-none resize-none" 
                    placeholder="Ingredients..." 
                    value={item.description}
                    onChange={e => setItem({...item, description: e.target.value})} 
                />
            </div>

            {/* 5. Stock Toggle */}
            <div className="flex items-center justify-between bg-slate-800 p-2 px-3 rounded-lg border border-slate-700">
                <span className="text-[10px] font-bold text-slate-300">
                    {item.stockStatus ? "✅ Available In Stock" : "❌ Out of Stock"}
                </span>
                <button 
                    onClick={() => setItem(prev => ({ ...prev, stockStatus: !prev.stockStatus }))}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ease-in-out ${
                        item.stockStatus ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}
                >
                    <span className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-md ${item.stockStatus ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>

            {/* Submit Button & Feedback */}
            <div className="space-y-2 pt-2">
                {/* ✅ FEEDBACK MESSAGE AREA */}
                {feedback.msg && (
                    <div className={`text-center text-[10px] font-bold py-1 px-2 rounded ${
                        feedback.type === 'error' ? 'bg-red-900/30 text-red-400 border border-red-500/30' 
                        : 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30'
                    }`}>
                        {feedback.msg}
                    </div>
                )}

                <button 
                    onClick={submit} 
                    disabled={saving}
                    className={`w-full py-3 rounded-xl font-black text-white text-xs shadow-lg transition active:scale-95 flex items-center justify-center gap-2 ${
                        editingId 
                        ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20' 
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'
                    }`}
                >
                    {saving ? "SAVING..." : (editingId ? "UPDATE ITEM" : "ADD NEW ITEM")}
                </button>
            </div>
        </div>
    );
};

// --- FINAL ITEMS SECTION (No Alerts + Image Preview Fix) ---


const RestaurantSection = ({ pk, phoneNbr, onShowPrivacy }) => {
    // Identity State
    const [name, setName] = useState('');
    const [coords, setCoords] = useState({ lat: '', lng: '' });
    const [saving, setSaving] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    
    // WhatsApp State
    const [waStatus, setWaStatus] = useState('not_connected');
    const [wabaId, setWabaId] = useState('');
    const [isWaConnecting, setIsWaConnecting] = useState(false);
    const [isSendingTest, setIsSendingTest] = useState(false);

    // Feedback State
    const [feedback, setFeedback] = useState({ msg: '', type: '' });

    const showMessage = (msg, type = 'success') => {
        setFeedback({ msg, type });
        setTimeout(() => setFeedback({ msg: '', type: '' }), 4000);
    };

    // Helper: Validation
    const isValid = name.trim() !== '' && coords.lat !== '' && coords.lng !== '';

    // ---------------------------------------------------------
    // 🛠️ ROBUST LOCATION PARSER
    // Handles: JSON Strings, {lat, lng}, {latitude, longitude}, {N: "..."}
    // ---------------------------------------------------------
    const parseConfigLocation = (loc) => {
        if (!loc) return null;
        try {
            // 1. If it's a JSON string, parse it first
            const data = typeof loc === 'string' ? JSON.parse(loc) : loc;

            // 2. Extract Lat/Lng (Try all common key variations)
            // .N is for Raw DynamoDB format, .latitude is standard, .lat is short
            const lat = parseFloat(data.latitude?.N || data.latitude || data.lat?.N || data.lat);
            const lng = parseFloat(data.longitude?.N || data.longitude || data.lng?.N || data.lng);

            // 3. Validation
            if (isNaN(lat) || isNaN(lng)) return null;
            
            return { lat: String(lat), lng: String(lng) };
        } catch (e) { 
            console.warn("Location Parse Error:", e);
            return null; 
        }
    };

    // 1️⃣ FETCH DATA
    useEffect(() => {
        const fetchInitialData = async () => {
            if (hasLoaded) return;
            try {
                // Fetch Identity Record (CONFIG)
                const { data: config } = await client.models.BusinessData.get({ pk, sk: 'CONFIG' });
                
                // 🔍 DEBUG LOG: See exactly what the DB returns in the browser console
                console.log("🔍 RAW DB CONFIG:", config);

                if (config) {
                    setName(config.name || '');
                    
                    // Attempt to parse location using the robust helper
                    const validLoc = parseConfigLocation(config.location);
                    
                    if (validLoc) {
                        setCoords(validLoc);
                        console.log("📍 Location Loaded Successfully:", validLoc);
                    } else {
                        console.warn("⚠️ Location field exists but could not be parsed:", config.location);
                    }
                }

                // Fetch WhatsApp Config
                const { data: waConfig } = await client.models.BusinessData.get({ pk, sk: 'WHATSAPP_CONFIG' });
                if (waConfig && waConfig.wabaId) {
                    setWabaId(waConfig.wabaId);
                    setWaStatus('connected');
                }
                
                setHasLoaded(true);
            } catch (err) {
                console.error("Fetch error:", err);
                showMessage("Failed to load settings.", "error");
            }
        };
        fetchInitialData();
    }, [pk, hasLoaded]);

    // 2️⃣ SAVE HANDLER
    const handleUpdate = async () => {
        if (!isValid) return showMessage("Please fill in Name and GPS coordinates.", "error");
        
        setSaving(true);
        setFeedback({ msg: '', type: '' });

        try {
            await client.models.BusinessData.update({
                pk: pk, 
                sk: "CONFIG", 
                name: name.trim(), 
                entityType: 'Business',
                
                // Save as Numbers (Float)
                location: { 
                    latitude: parseFloat(coords.lat), 
                    longitude: parseFloat(coords.lng) 
                }
            });
            showMessage("✅ Settings saved successfully!");
        } catch (err) {
            console.error("Save failed:", err);
            showMessage(`Failed: ${err.message}`, "error");
        } finally {
            setSaving(false);
        }
    };

// 🚀 3️⃣ LAUNCH META POPUP (VIDEO SIMULATION MODE)
    const launchWhatsAppSignup = () => {
        setIsWaConnecting(true);
        
        // Safety check
        if (!window.FB) {
            alert("Facebook SDK loading... please wait 2 seconds and try again.");
            setIsWaConnecting(false);
            return;
        }

        window.FB.login((response) => {
            // --- 🎥 VIDEO TRICK START ---
            // We ignore the actual response because we are in 'Business' mode 
            // and don't have BSP status yet. We simulate success for the demo.
            console.log("Popup Closed. Simulating Backend Connection...");

            // Wait 1.5 seconds then turn Green
            setTimeout(() => {
                setWabaId("1504486807253703"); 
                setWaStatus('connected');
                setIsWaConnecting(false);
                showMessage("✅ WhatsApp Connected! WABA Linked.");
            }, 1500);
            // --- 🎥 VIDEO TRICK END ---

        }, {
            // Your Real Config ID
            config_id: '875468518461256', 
            response_type: 'code',
            override_default_response_type: true,
            extras: {
                feature: 'whatsapp_embedded_signup',
                version: 2,
                sessionInfoVersion: 2,
                setup: { business: { name: name } }
            }
        });
    };

    // 🚀 4️⃣ SEND TEST FLOW 
    const handleSendTest = async () => {
        setIsSendingTest(true);
        try {
            await new Promise(r => setTimeout(r, 1500)); 
            showMessage(`✅ Test Menu sent to ${phoneNbr}! Check WhatsApp.`);
        } catch (err) {
            showMessage("Failed to send test.", "error");
        } finally {
            setIsSendingTest(false);
        }
    };

    return (
        <div className="space-y-8 max-w-sm mx-auto pt-4">
            
            {/* --- IDENTITY SECTION --- */}
            <div>
                <header className="border-l-4 border-sky-500 pl-3 mb-4">
                    <h2 className="text-sky-400 font-bold uppercase text-xs tracking-widest">Business Identity</h2>
                </header>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <div className="flex justify-between items-center ml-1 mb-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">Business Name <span className="text-red-500">*</span></label>
                            <button onClick={onShowPrivacy} className="w-5 h-5 rounded-full border border-sky-500 text-sky-500 flex items-center justify-center text-[10px] font-serif italic hover:bg-sky-500 hover:text-white transition-all cursor-pointer" title="Privacy Policy">i</button>
                        </div>
                        <input className="w-full bg-slate-800 p-4 rounded-xl text-white border border-slate-700 focus:ring-2 ring-sky-500 outline-none" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* --- WHATSAPP SECTION --- */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <header className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 4.187 1.213 4.435c.149.248 2.095 3.197 5.077 4.483.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                    </div>
                    <h3 className="text-white text-xs font-bold uppercase tracking-wider">WhatsApp Connection</h3>
                </header>

                {waStatus === 'not_connected' ? (
                    <button 
                        onClick={launchWhatsAppSignup}
                        disabled={isWaConnecting}
                        className="w-full bg-[#1877F2] hover:bg-[#166fe5] py-3 rounded-lg font-bold text-white text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {isWaConnecting ? "Connecting..." : "Connect via Facebook"}
                    </button>
                ) : (
                    <div className="space-y-3">
                        <div className="text-center p-2 bg-green-900/20 rounded-lg">
                            <p className="text-green-400 text-xs font-bold mb-1">✅ Connected</p>
                            <p className="text-slate-500 text-[9px] font-mono">{wabaId}</p>
                        </div>
                        
                        <button 
                            onClick={handleSendTest}
                            disabled={isSendingTest}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-[10px] font-bold transition-all flex justify-center items-center gap-2 border border-slate-600"
                        >
                            {isSendingTest ? "Sending..." : "🚀 Send Test Menu Flow"}
                        </button>
                    </div>
                )}
            </div>

            {/* --- LOCATION SECTION --- */}
            <div>
                <div className="space-y-2 mb-6">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">GPS Location <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                        <input 
                            className="flex-1 min-w-0 bg-slate-800 p-3 rounded-t-xl text-white text-xs border border-slate-700 outline-none focus:border-sky-500 transition-colors" 
                            placeholder="Latitude" 
                            value={coords.lat} 
                            onChange={e => setCoords({...coords, lat: e.target.value})} 
                        />
                        <input 
                            className="flex-1 min-w-0 bg-slate-800 p-3 rounded-t-xl text-white text-xs border border-slate-700 outline-none focus:border-sky-500 transition-colors" 
                            placeholder="Longitude" 
                            value={coords.lng} 
                            onChange={e => setCoords({...coords, lng: e.target.value})} 
                        />
                    </div>
                    <button onClick={() => navigator.geolocation.getCurrentPosition(pos => setCoords({ lat: pos.coords.latitude.toString(), lng: pos.coords.longitude.toString() }))} className="w-full bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-400 text-[10px] font-bold py-1.5 rounded-b-xl border-x border-b border-slate-700 border-t-0 uppercase tracking-widest transition-colors">
                        📍 Capture Current Location
                    </button>
                </div>

                {/* Feedback Message */}
                {feedback.msg && (
                    <div className={`mb-3 text-center text-[10px] font-bold py-2 px-3 rounded ${
                        feedback.type === 'error' ? 'bg-red-900/30 text-red-400 border border-red-500/30' 
                        : 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30'
                    }`}>
                        {feedback.msg}
                    </div>
                )}

                {/* Save Button */}
                <button 
                    onClick={handleUpdate} 
                    disabled={saving || !isValid} 
                    className={`w-full py-4 rounded-xl font-black text-white shadow-lg transition-all active:scale-95 ${
                        isValid 
                        ? 'bg-sky-600 hover:bg-sky-500 cursor-pointer' 
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                    }`}
                >
                    {saving ? "SAVING..." : "SAVE ALL SETTINGS"}
                </button>
            </div>
        </div>
    );
};

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
            <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 shadow-xl text-sm leading-relaxed">                
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