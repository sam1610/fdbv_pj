import React, { useState, useEffect } from 'react';
import { client } from '../DataHook/amplifyClient';
import AgentsView from './AgentsView';

// ✅ GLOBAL CONSTANTS
// Removed 'Templates' from tabs
const TABS = ['Restaurant', 'Branches', 'Items', 'Agents'];

// Helper: Parse Location Data safely
const parseConfigLocation = (loc) => {
    if (!loc) return null;
    try {
        const data = typeof loc === 'string' ? JSON.parse(loc) : loc;
        const lat = parseFloat(data.latitude?.N || data.latitude || data.lat?.N || data.lat);
        const lng = parseFloat(data.longitude?.N || data.longitude || data.lng?.N || data.lng);
        if (isNaN(lat) || isNaN(lng)) return null;
        return { lat: String(lat), lng: String(lng) };
    } catch (e) {
        return null;
    }
};

// =========================================================
// 1️⃣ MAIN COMPONENT: SetupConsole
// =========================================================
export default function SetupConsole({ phoneNbr, onDataChange, businessLocation, setModal }) {
    const [activeTab, setActiveTab] = useState('Restaurant');
    const businessPk = `BUSINESS#${phoneNbr}`;

    // Removed Facebook SDK useEffect - No longer needed for Zero Entry

    return (
        <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
            {/* Navigation Header */}
            <div className="flex bg-slate-800 p-2 border-b border-slate-700 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 min-w-[80px] py-3 px-2 rounded-xl text-[11px] font-black uppercase tracking-tighter transition-all whitespace-nowrap 
                            ${activeTab === tab
                                ? 'bg-sky-600 text-white shadow-lg'
                                : 'text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
                {/* Privacy Tab (Icon only) */}
                {/* <button
                    onClick={() => setActiveTab('ⓘ')}
                    className={`min-w-[40px] py-3 px-2 rounded-xl text-[11px] font-black transition-all ${activeTab === 'ⓘ' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                    ⓘ
                </button> */}
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto p-4 pb-24">
                {activeTab === 'Restaurant' && (
                    <RestaurantSection
                        pk={businessPk}
                        phoneNbr={phoneNbr}
                    />
                )}

                {activeTab === 'Branches' && <BranchesSection pk={businessPk} />}
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


// =========================================================
// 2️⃣ SUB-COMPONENT: RestaurantSection (Updated for Dynamic Name)

// =========================================================
// 2️⃣ SUB-COMPONENT: RestaurantSection (SaaS Upgraded)
// =========================================================
// =========================================================
// 2️⃣ SUB-COMPONENT: RestaurantSection (SaaS Upgraded)
// =========================================================
const RestaurantSection = ({ pk, phoneNbr }) => {
    // Identity State
    const [name, setName] = useState('');
    const [coords, setCoords] = useState({ lat: '', lng: '' });
    const [saving, setSaving] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    // Phone Registration State
    const [verificationMethod, setVerificationMethod] = useState('SMS');
    const [phoneVerificationStep, setPhoneVerificationStep] = useState(null);
    const [otpCode, setOtpCode] = useState('');
    const [tempPhoneId, setTempPhoneId] = useState(null);

    // Meta Data State
    const [metaData, setMetaData] = useState({
        metaBusinessAccountId: '',
        phoneNumber: '',
        phoneNumberId: '',
        wabaId: '',
        registrationStatus: 'PENDING',
        assignedPin: ''
    });

    const [feedback, setFeedback] = useState({ msg: '', type: '' });

    const showMessage = (msg, type = 'success') => {
        setFeedback({ msg, type });
        setTimeout(() => setFeedback({ msg: '', type: '' }), 5000);
    };

    const handleCoordChange = (field, value) => {
        const isFloat = /^-?[0-9]*\.?[0-9]*$/.test(value);
        if (isFloat || value === "") {
            setCoords(prev => ({ ...prev, [field]: value }));
        }
    };

    // --- FETCH DATA ---
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!client || hasLoaded) return;
            const lockTime = localStorage.getItem(`meta_lock_${phoneNbr}`);
            if (lockTime) {
                const elapsed = Date.now() - parseInt(lockTime);
                if (elapsed < 2 * 60 * 60 * 1000) { // 2 hours in milliseconds
                    setPhoneVerificationStep('PENDING_REVIEW');
                } else {
                    localStorage.removeItem(`meta_lock_${phoneNbr}`); // Expire the lock
                }
            }
            try {
                const { data: config } = await client.models.BusinessData.get({ pk, sk: 'CONFIG' });
                if (config) {
                    setName(config.name || '');
                    try {
                        const loc = typeof config.location === 'string' ? JSON.parse(config.location) : config.location;
                        const lat = loc.latitude?.N || loc.latitude || loc.lat;
                        const lng = loc.longitude?.N || loc.longitude || loc.lng;
                        if (lat) setCoords({ lat: String(lat), lng: String(lng) });
                    } catch (e) { }
                }

                const { data: metaRecords } = await client.models.RestaurantMetaAccount.list({
                    filter: { restaurantId: { eq: phoneNbr } }
                });

                if (metaRecords && metaRecords.length > 0) {
                    const metaRecord = metaRecords[0];
                    setMetaData({
                        metaBusinessAccountId: metaRecord.metaBusinessAccountId || '',
                        phoneNumber: metaRecord.phoneNumber || '',
                        phoneNumberId: metaRecord.phoneNumberId || '',
                        wabaId: metaRecord.wabaId || '',
                        registrationStatus: metaRecord.registrationStatus || 'PENDING',
                        assignedPin: ''
                    });

                    // ✅ If they are already ACTIVE in the DB, lock the UI to the success screen
                    if (metaRecord.registrationStatus === 'ACTIVE') {
                        setPhoneVerificationStep('ACTIVE');
                    }
                }
                setHasLoaded(true);
            } catch (err) {
                console.error("Fetch error:", err);
            }
        };
        fetchInitialData();
    }, [pk, phoneNbr, hasLoaded]);

    // --- SAVE BUSINESS IDENTITY ---
    const handleUpdateBusinessConfig = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) return showMessage("Please fill in Business Name", "error");

        // ✅ NEW: Block forbidden Meta names
        if (trimmedName.toLowerCase() === 'home') {
            return showMessage("Meta policy: 'Home' is a forbidden Business Name. Please use a real brand name.", "error");
        }
        setSaving(true);
        try {
            await client.models.BusinessData.update({
                pk: pk,
                sk: "CONFIG",
                name: name.trim(),
                entityType: 'Business',
                location: JSON.stringify({
                    latitude: parseFloat(coords.lat),
                    longitude: parseFloat(coords.lng)
                })
            });
            showMessage("✅ Business config saved!");
        } catch (err) {
            showMessage(`Failed: ${err.message}`, "error");
        } finally {
            setSaving(false);
        }
    };

  // --- STEP 1: REQUEST OTP ---
    const handleRequestPhoneVerification = async () => {
        if (!name.trim()) return showMessage("Please fill in Business Name first", "error");
        
        setPhoneVerificationStep('REQUESTING_CODE');
        try {
            const response = await client.mutations.registerPhoneNumber({
                action: 'REQUEST_PHONE_VERIFICATION',
                businessPhone: phoneNbr,
                businessPhoneOwner: phoneNbr,
                verificationMethod: verificationMethod,
                businessName: name.trim() 
            });

            console.log("DEBUG: Mutation Response:", response); 

            // ✅ THE MISSING SUCCESS LOGIC
            if (response.data?.success) {
                // Parse the returned data to get the phoneId Meta generated
                const innerData = response.data.data ? JSON.parse(response.data.data) : {};
                if (innerData.phoneNumberId) {
                    setTempPhoneId(innerData.phoneNumberId);
                }
                
                // Move the UI to the OTP input screen
                setPhoneVerificationStep('WAITING_OTP');
                showMessage(`Code sent via ${verificationMethod}!`, "success");
                
            } else {
                setPhoneVerificationStep(null);
                showMessage(`Failed: ${response.data?.message || "Check Browser Console"}`, "error");
            }
        } catch (err) {
            setPhoneVerificationStep(null);
            console.error("CRITICAL: Frontend Mutation Error:", err);
            showMessage(`Network error: ${err.message}`, "error");
        }
    };

    // --- STEP 2: VERIFY OTP ---
    const handleVerifyPhoneOTP = async () => {
        if (!otpCode.trim()) return showMessage("Please enter the OTP code", "error");
        setPhoneVerificationStep('VERIFYING_OTP');

        try {
            const { data: response } = await client.mutations.registerPhoneNumber({
                action: 'VERIFY_PHONE_OTP',
                businessPhone: phoneNbr,
                otpCode: otpCode.trim(),
                phoneNumberId: tempPhoneId,
                businessPhoneOwner: phoneNbr,
                businessName: name.trim()
            });

            if (response && response.success) {
                const innerData = response.data ? JSON.parse(response.data) : {};
                
                const newMetaData = {
                    metaBusinessAccountId: innerData.wabaId || '',
                    phoneNumber: phoneNbr,
                    phoneNumberId: innerData.phoneNumberId || '',
                    wabaId: innerData.wabaId || '',
                    registrationStatus: 'ACTIVE',
                    assignedPin: innerData.assignedPin || ''
                };
                
                setMetaData(newMetaData);

                // ✅ NEW: Actually save the credentials to the database!
                try {
                     await client.models.RestaurantMetaAccount.create({
                        restaurantId: phoneNbr,
                        metaBusinessAccessToken: innerData.accessToken || process.env.REACT_APP_META_SYSTEM_USER_TOKEN, // Use token from response or your global one
                        phoneNumberId: innerData.phoneNumberId,
                        wabaId: innerData.wabaId,
                        phoneNumber: phoneNbr,
                        registrationStatus: 'ACTIVE'
                    });
                    console.log("Credentials saved to RestaurantMetaAccount table.");
                } catch (dbErr) {
                     console.error("Failed to save credentials to DB:", dbErr);
                     // Optional: If create fails because it already exists, run an update here
                }

                setPhoneVerificationStep('ACTIVE');
                setOtpCode('');
                showMessage("✅ Phone securely registered to WhatsApp API!", "success");
            }
            else if (response && response.message === "PENDING_META_REVIEW") {
                setPhoneVerificationStep('PENDING_REVIEW');
            }
            else {
                setPhoneVerificationStep('WAITING_OTP');
                showMessage(`Verification failed: ${response?.message || "Invalid OTP"}`, "error");
            }
        } catch (err) {
            setPhoneVerificationStep('WAITING_OTP');
            showMessage(`Network error: ${err.message}`, "error");
        }
    };

    // --- RENDER UI ---
    return (
        <div className="space-y-8 max-w-sm mx-auto pt-4">

            {/* 1. BUSINESS IDENTITY */}
            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700">
                <header className="border-l-4 border-sky-500 pl-3 mb-4">
                    <h2 className="text-sky-400 font-bold uppercase text-xs tracking-widest">1. Business Identity</h2>
                    <p className="text-[9px] text-slate-500 mt-1">Your restaurant's basic info</p>
                </header>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Business Name <span className="text-red-500">*</span></label>
                        <input
                            className="w-full bg-slate-900 p-4 rounded-xl text-white border border-slate-700 focus:ring-2 ring-sky-500 outline-none"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            disabled={phoneVerificationStep === 'ACTIVE'} // Optional: Prevent name change if already registered to Meta
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Location Coordinates</label>
                        <div className="flex gap-2">
                            <input className="flex-1 bg-slate-900 p-3 rounded-xl text-white text-xs border border-slate-700 focus:ring-2 ring-sky-500 outline-none font-mono" placeholder="Latitude" value={coords.lat} onChange={e => handleCoordChange('lat', e.target.value)} />
                            <input className="flex-1 bg-slate-900 p-3 rounded-xl text-white text-xs border border-slate-700 focus:ring-2 ring-sky-500 outline-none font-mono" placeholder="Longitude" value={coords.lng} onChange={e => handleCoordChange('lng', e.target.value)} />
                        </div>
                    </div>

                    <button onClick={() => navigator.geolocation.getCurrentPosition(pos => setCoords({ lat: pos.coords.latitude.toString(), lng: pos.coords.longitude.toString() }))} className="w-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[10px] font-bold py-2 rounded-xl border border-sky-500/20 transition-all mb-2">
                        📍 Capture Current Location
                    </button>
                    <button onClick={handleUpdateBusinessConfig} disabled={saving} className="w-full py-3 rounded-xl font-black text-white bg-sky-600 hover:bg-sky-500 shadow-lg transition-all disabled:opacity-50">
                        {saving ? "SAVING..." : "SAVE BUSINESS INFO"}
                    </button>
                </div>
            </div>

            {/* 2. PHONE NUMBER REGISTRATION */}
            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700">
                <header className="flex items-center gap-2 mb-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${phoneVerificationStep === 'ACTIVE' ? 'bg-green-500' : 'bg-slate-600'}`}>
                        <span className="text-white font-bold text-xs">W</span>
                    </div>
                    <div>
                        <h2 className="text-green-400 font-bold uppercase text-xs tracking-widest">2. WhatsApp Activation</h2>
                        <p className="text-[9px] text-slate-500 mt-0.5">Link your account phone number</p>
                    </div>
                </header>

                {/* ✅ EXACT UI SEPARATION BASED ON STATE */}
                {phoneVerificationStep === 'ACTIVE' ? (
                    // IF ALREADY REGISTERED: Hide all setup options
                    <div className="space-y-3">
                        <div className="text-center p-4 bg-green-900/20 rounded-lg border border-green-500/30">
                            <p className="text-green-400 text-xs font-bold mb-2">✅ WhatsApp Business Connected</p>
                            <p className="text-white font-mono font-bold text-lg mb-3">{metaData.phoneNumber || phoneNbr}</p>

                            <div className="bg-slate-900/60 p-3 rounded border border-slate-700 space-y-3 text-left">
                                <div>
                                    <p className="text-[9px] text-slate-500"><strong>PHONE NUMBER ID</strong></p>
                                    <p className="text-[9px] text-slate-400 font-mono break-all">{metaData.phoneNumberId || 'Verified'}</p>
                                </div>
                                {/* Only show PIN immediately after generation, not on subsequent page loads */}
                                {metaData.assignedPin && (
                                    <div className="pt-2 border-t border-slate-700">
                                        <p className="text-[9px] text-slate-500"><strong>WHATSAPP API PIN</strong></p>
                                        <p className="text-[11px] text-emerald-400 font-mono font-bold tracking-widest">{metaData.assignedPin}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                ) : phoneVerificationStep === 'PENDING_REVIEW' ? (
                    // IF NAME REJECTED/REVIEWING: Show lockout screen
                    <div className="space-y-3">
                        <div className="text-center p-5 bg-yellow-900/20 rounded-xl border border-yellow-500/30 shadow-inner">
                            <div className="w-10 h-10 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center mb-3">
                                <span className="text-yellow-500 text-lg">⏳</span>
                            </div>
                            <p className="text-yellow-400 text-sm font-black mb-2 uppercase tracking-wide">Pending Meta Approval</p>
                            <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                                Meta is currently reviewing your Business Name ("<strong>{name}</strong>") to ensure it meets their commerce guidelines.
                            </p>
                            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 mb-3">
                                <p className="text-[10px] text-slate-400">
                                    This automated security review usually takes between <strong>1 to 24 hours</strong>. To protect your account from being flagged for spam, the connection button has been disabled for 2 hours.
                                </p>
                            </div>
                            {/* ✅ Button removed. They are safely locked here. */}
                        </div>
                    </div>

                ) : phoneVerificationStep === 'WAITING_OTP' ? (
                    // IF OTP SENT: Show input field
                    <div className="space-y-3">
                        <p className="text-[10px] text-blue-200 bg-blue-900/20 p-2 rounded border border-blue-500/30">
                            📱 Code sent via <strong>{verificationMethod}</strong> to <strong>{phoneNbr}</strong>
                        </p>
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-2">Enter 6-Digit Code</label>
                            <input type="text" maxLength="6" inputMode="numeric" placeholder="000000" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-900 p-4 rounded-xl text-white text-center text-2xl font-bold tracking-[0.5em] border border-slate-700 focus:ring-2 ring-green-500 outline-none" />
                        </div>
                        <button onClick={handleVerifyPhoneOTP} disabled={otpCode.length !== 6} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 py-3 rounded-lg font-bold text-white text-xs shadow-md transition-all">
                            VERIFY & ACTIVATE API
                        </button>
                        <button onClick={() => { setPhoneVerificationStep(null); setOtpCode(''); }} className="w-full text-slate-400 text-[9px] font-bold py-2 transition-all hover:text-slate-300">← Cancel</button>
                    </div>

                ) : phoneVerificationStep === 'VERIFYING_OTP' || phoneVerificationStep === 'REQUESTING_CODE' ? (
                    // IF LOADING: Show spinner
                    <div className="text-center py-8">
                        <div className="w-8 h-8 mx-auto border-4 border-slate-600 border-t-sky-500 rounded-full animate-spin mb-3"></div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Communicating with Meta...</p>
                    </div>

                ) : (
                    // DEFAULT VIEW: Show request options
                    <div className="space-y-4">
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex items-center justify-between shadow-inner">
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase">Principal Phone</p>
                                <p className="text-white font-mono text-lg font-bold tracking-wide mt-1">{phoneNbr}</p>
                            </div>
                            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
                            <button onClick={() => setVerificationMethod('SMS')} className={`py-2 rounded-md text-xs font-bold transition-all ${verificationMethod === 'SMS' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                                📩 Send SMS
                            </button>
                            <button onClick={() => setVerificationMethod('VOICE')} className={`py-2 rounded-md text-xs font-bold transition-all ${verificationMethod === 'VOICE' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                                📞 Call Me
                            </button>
                        </div>

                        <button onClick={handleRequestPhoneVerification} className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-lg font-bold text-white text-xs shadow-md transition-all">
                            VERIFY & CONNECT
                        </button>
                    </div>
                )}
            </div>

            {/* FEEDBACK */}
            {feedback.msg && (
                <div className={`text-center text-[10px] font-bold py-3 px-3 rounded-lg border ${feedback.type === 'error' ? 'bg-red-900/30 text-red-400 border-red-500/30' : 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30'}`}>
                    {feedback.msg}
                </div>
            )}
        </div>
    );
};
const ItemsSection = ({ pk, onUpdate }) => {
    const BASE64_HEADER = "data:image/jpeg;base64,";
    const [item, setItem] = useState({
        name: '', price: '', description: '', quantity: '',
        stockStatus: true,
        imageUrl: ''
    });
    const [allItems, setAllItems] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [category, setCategory] = useState('');
    const [existingCategories, setExistingCategories] = useState([]);
    const [showItemSuggestions, setShowItemSuggestions] = useState(false);
    const [showCatSuggestions, setShowCatSuggestions] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 70; canvas.height = 70;
                ctx.drawImage(img, 0, 0, 70, 70);
                setItem(prev => ({ ...prev, imageUrl: canvas.toDataURL('image/jpeg', 0.7) }));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    const fetchItems = async () => {
        try {
            const { data } = await client.models.BusinessData.listByBusiness({ pk: pk, sk: { beginsWith: 'ITEM#' } });
            setAllItems(data.sort((a, b) => a.name.localeCompare(b.name)));
            const uniqueCats = [...new Set(data.map(i => i.itemCategory).filter(c => c))].sort();
            setExistingCategories(uniqueCats);
        } catch (err) { console.error("Fetch items error", err); }
    };
    useEffect(() => { fetchItems(); }, [pk]);

    const filteredItems = allItems.filter(i => i.name.toLowerCase().includes(item.name.toLowerCase()));
    const filteredCategories = existingCategories.filter(c => c.toLowerCase().includes(category.toLowerCase()));

    const selectItemToEdit = (selectedItem) => {
        setEditingId(selectedItem.sk);
        const previewImage = selectedItem.imageUrl ? (selectedItem.imageUrl.startsWith('data:') ? selectedItem.imageUrl : BASE64_HEADER + selectedItem.imageUrl) : '';
        setItem({
            name: selectedItem.name,
            price: selectedItem.unitPrice.toString(),
            description: selectedItem.description || '',
            quantity: selectedItem.quantity || '',
            stockStatus: selectedItem.stockStatus !== false,
            imageUrl: previewImage
        });
        setCategory(selectedItem.itemCategory || '');
        setShowItemSuggestions(false);
    };

    const clearForm = () => {
        setItem({ name: '', price: '', description: '', quantity: '', stockStatus: true, imageUrl: '' });
        setCategory('');
        setEditingId(null);
    };

    // ✅ UPDATED SUBMIT LOGIC: Queries DB for the latest ITEM ID
    const submit = async () => {
        if (!item.name.trim() || !item.price || !category.trim()) return alert("Missing fields");
        setSaving(true);
        const dbImageString = item.imageUrl.replace(BASE64_HEADER, '');

        const payload = {
            pk,
            name: item.name.trim(),
            unitPrice: parseFloat(item.price),
            itemCategory: category.trim(),
            description: item.description,
            stockStatus: item.stockStatus,
            quantity: item.quantity ? parseInt(item.quantity) : 0,
            imageUrl: dbImageString
        };

        try {
            if (editingId) {
                await client.models.BusinessData.update({ ...payload, sk: editingId });
            } else {
                // Query Database for the Highest ITEM ID
                const { data: latestItemData } = await client.models.BusinessData.listByBusiness({
                    pk: pk,
                    sk: { beginsWith: 'ITEM#' },
                    sortDirection: 'DESC', // Get greatest first
                    limit: 1 // Only need the top 1
                });

                let nextNum = 1;
                if (latestItemData && latestItemData.length > 0) {
                    const latestSk = latestItemData[0].sk; // e.g. "ITEM#015"
                    const parsedNum = parseInt(latestSk.split('#')[1], 10);
                    if (!isNaN(parsedNum)) {
                        nextNum = parsedNum + 1; // Increment
                    }
                }

                const newSk = `ITEM#${String(nextNum).padStart(3, '0')}`; // Format e.g. "ITEM#016"

                await client.models.BusinessData.create({ ...payload, sk: newSk, entityType: 'ITEM' });
            }
            await fetchItems();
            if (onUpdate) onUpdate();
            clearForm();
        } catch (err) { alert("Error saving item"); console.error(err); } finally { setSaving(false); }
    };

    return (
        <div className="space-y-4 max-w-sm mx-auto pt-4 animate-fade-in pb-20">
            <header className="flex justify-between items-end border-b border-indigo-500 pb-2 mb-2">
                <h2 className="text-indigo-400 font-bold uppercase text-xs tracking-widest">Menu Manager</h2>
                {editingId && (
                    <button onClick={clearForm} className="text-[10px] text-slate-400 hover:text-white transition-colors">
                        ✕ Cancel Edit
                    </button>
                )}
            </header>

            {/* Name Input with Autocomplete */}
            <div className="relative">
                <input className="w-full bg-slate-800 p-3 rounded-lg text-white border border-slate-700 outline-none text-sm" placeholder="Item Name" value={item.name} onChange={(e) => { setItem({ ...item, name: e.target.value }); if (!editingId) setShowItemSuggestions(true); }} onBlur={() => setTimeout(() => setShowItemSuggestions(false), 200)} />
                {showItemSuggestions && filteredItems.length > 0 && (
                    <div className="absolute z-50 w-full bg-slate-800 border border-slate-600 rounded-xl mt-1 max-h-48 overflow-y-auto">
                        {filteredItems.map(s => <button key={s.sk} onMouseDown={() => selectItemToEdit(s)} className="w-full text-left px-4 py-2 text-slate-300 text-xs border-b border-slate-700">{s.name}</button>)}
                    </div>
                )}
            </div>

            {/* Image and Category */}
            <div className="flex gap-2 items-end">
                <div className="relative w-[70px] h-[70px] bg-slate-800 rounded-lg border border-slate-700 overflow-hidden cursor-pointer">
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImageUpload} />
                    {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" alt="prev" /> : <div className="w-full h-full flex items-center justify-center text-slate-500 text-xl">+</div>}
                </div>
                <div className="flex-1 relative">
                    <input className="w-full bg-slate-800 p-3 h-[70px] rounded-lg text-white border border-slate-700 outline-none text-sm" placeholder="Category" value={category} onChange={(e) => { setCategory(e.target.value); setShowCatSuggestions(true); }} onBlur={() => setTimeout(() => setShowCatSuggestions(false), 200)} />
                    {showCatSuggestions && (
                        <div className="absolute top-full z-50 w-full bg-slate-800 border border-slate-600 rounded-xl mt-1 max-h-40 overflow-y-auto">
                            {filteredCategories.map(c => <button key={c} onMouseDown={() => { setCategory(c); setShowCatSuggestions(false); }} className="w-full text-left px-4 py-2 text-slate-300 text-xs border-b border-slate-700">{c}</button>)}
                        </div>
                    )}
                </div>
            </div>

            {/* Price, Qty, and Stock Status */}
            <div className="flex gap-2">
                <button
                    onClick={() => setItem(prev => ({ ...prev, stockStatus: !prev.stockStatus }))}
                    className={`px-3 rounded-lg font-bold text-[10px] uppercase tracking-wide border transition-all ${item.stockStatus
                            ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-900/30 text-red-400 border-red-500/30'
                        }`}
                >
                    {item.stockStatus ? 'In Stock' : 'Sold Out'}
                </button>


                <input
                    className=" w-28 bg-slate-800 p-3 rounded-lg text-white border border-slate-700 outline-none text-sm"
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={e => setItem({ ...item, quantity: e.target.value })}
                />
                <input
                    className="flex-1 w-20 bg-slate-800 p-3 rounded-lg text-white border border-slate-700 outline-none text-sm"
                    placeholder="Price"
                    value={item.price}
                    onChange={e => setItem({ ...item, price: e.target.value })}
                />
            </div>

            {/* Description Input */}
            <textarea
                className="w-full bg-slate-800 p-3 rounded-lg text-white border border-slate-700 outline-none text-sm h-20"
                placeholder="Description"
                value={item.description}
                onChange={e => setItem({ ...item, description: e.target.value })}
            />

            {/* Action Buttons */}
            <div className="flex gap-2">
                <button onClick={clearForm} className="px-4 rounded-xl font-bold text-slate-400 bg-slate-800 border border-slate-700 hover:bg-slate-700">Clear</button>
                <button onClick={submit} disabled={saving} className="flex-1 py-3 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg transition-all">
                    {saving ? "SAVING..." : (editingId ? "UPDATE ITEM" : "ADD NEW ITEM")}
                </button>
            </div>
        </div>
    );
};
// =========================================================
// 5️⃣ SUB-COMPONENT: PrivacyPolicySection (Unchanged)
// =========================================================
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
const BranchesSection = ({ pk }) => {
    return (
        <div className="p-8 bg-slate-800/40 rounded-xl border border-slate-700 text-center animate-fade-in">
            <div className="w-12 h-12 mx-auto bg-slate-700 rounded-full flex items-center justify-center mb-4">
                <span className="text-xl">🏪</span>
            </div>
            <h2 className="text-sky-400 font-bold uppercase text-xs tracking-widest mb-2">Branch Management</h2>
            <p className="text-slate-400 text-xs">Branch configuration UI is coming soon.</p>
        </div>
    );
};