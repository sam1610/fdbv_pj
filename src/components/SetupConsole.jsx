import React, { useState, useEffect } from 'react';
import { client } from '../DataHook/amplifyClient';
import AgentsView from './AgentsView'; 
// import { registerBusinessPhone } from '../../functions/registerBusinessPhone/resource';

// ✅ GLOBAL CONSTANTS & HELPERS
const TABS = ['Restaurant', 'Branches', 'Items', 'Agents', 'Templates'];
const API_URL = "https://gl2yhmcz3p7pwufurreqigtpf40gjihi.lambda-url.us-east-1.on.aws/"; 

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

// Helper: Launch Meta Popup
const launchWhatsAppSignup = (appId) => {
    const config = {
        app_id: appId || '29979645098350108',
        override: "false",
        response_type: 'code',
        extras: {
            "setup": { "management": "true" },
            "sessionInfoVersion": "2",
        }
    };

    const facebookLoginUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${config.app_id}&redirect_uri=${window.location.origin}/&response_type=${config.response_type}&scope=whatsapp_business_management,whatsapp_business_messaging`;
    
    const width = 600, height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    window.open(facebookLoginUrl, 'WhatsAppSignup', `width=${width},height=${height},top=${top},left=${left}`);
};

// =========================================================
// 1️⃣ MAIN COMPONENT: SetupConsole
// =========================================================
export default function SetupConsole({ phoneNbr, onDataChange, businessLocation, setModal }) {
    const [activeTab, setActiveTab] = useState('Restaurant');
    const businessPk = `BUSINESS#${phoneNbr}`;

    // Initialize Facebook SDK (Global)
    useEffect(() => {
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
            {/* Navigation Header */}
            <div className="flex bg-slate-800 p-2 border-b border-slate-700 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 min-w-[80px] py-3 px-2 rounded-xl text-[11px] font-black uppercase tracking-tighter transition-all whitespace-nowrap 
                            ${activeTab === tab 
                            ?  'bg-sky-600 text-white shadow-lg'
                            : 'text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto p-4 pb-24">
                {activeTab === 'Restaurant' && (
                    <RestaurantSection 
                        pk={businessPk} 
                        phoneNbr={phoneNbr} 
                        onShowPrivacy={() => setActiveTab('ⓘ')} 
                    />
                )}
                
                {activeTab === 'Branches' && <BranchesSection pk={businessPk} />}
                {activeTab === 'Items' && <ItemsSection pk={businessPk} onUpdate={onDataChange} />}
                
                {activeTab === 'Agents' && (
                    <div className="animate-fade-in">
                        <AgentsView phoneNbr={phoneNbr} setModal={setModal} onAgentAdded={onDataChange} businessLocation={businessLocation} />
                    </div>
                )}
                {activeTab === 'Templates' && <TemplatesSection />}
                {activeTab === 'ⓘ' && <PrivacyPolicySection />}
            </div>
        </div>
    );
}



const RestaurantSection = ({ pk, phoneNbr, onShowPrivacy }) => {
    // Identity State
    const [name, setName] = useState('');
    const [coords, setCoords] = useState({ lat: '', lng: '' });
    const [saving, setSaving] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    
    // Phone Registration State
    const [businessPhoneInput, setBusinessPhoneInput] = useState('');
    const [phoneVerificationStep, setPhoneVerificationStep] = useState(null); 
    // States: null | 'REQUESTING_CODE' | 'WAITING_OTP' | 'VERIFYING_OTP' | 'ACTIVE'
    const [otpCode, setOtpCode] = useState('');
    const [tempPhoneId, setTempPhoneId] = useState(null); 
    
    // Meta Data State
    const [metaData, setMetaData] = useState({
        metaBusinessAccountId: '',
        phoneNumber: '',
        phoneNumberId: '',
        wabaId: '',
        registrationStatus: 'PENDING'
    });
    
    const [feedback, setFeedback] = useState({ msg: '', type: '' });

    const showMessage = (msg, type = 'success') => {
        setFeedback({ msg, type });
        setTimeout(() => setFeedback({ msg: '', type: '' }), 4000);
    };

    // --- FETCH DATA ---
    useEffect(() => {
        const fetchInitialData = async () => {
            if (hasLoaded) return;
            try {
                // 1. Fetch Identity
                const { data: config } = await client.models.BusinessData.get({ pk, sk: 'CONFIG' });
                if (config) {
                    setName(config.name || '');
                    const validLoc = parseConfigLocation(config.location);
                    if (validLoc) setCoords(validLoc);
                }

                // 2. Fetch Meta Account
                const { data: metaRecord } = await client.models.RestaurantMetaAccount.get({ 
                    restaurantId: phoneNbr 
                });
                
                if (metaRecord) {
                    setMetaData({
                        metaBusinessAccountId: metaRecord.metaBusinessAccountId || '',
                        phoneNumber: metaRecord.phoneNumber || '',
                        phoneNumberId: metaRecord.phoneNumberId || '',
                        wabaId: metaRecord.wabaId || '',
                        registrationStatus: metaRecord.registrationStatus || 'PENDING'
                    });
                    
                    if (metaRecord.phoneNumber && metaRecord.registrationStatus === 'ACTIVE') {
                        setBusinessPhoneInput(metaRecord.phoneNumber);
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
        if (!name.trim()) return showMessage("Please fill in Business Name", "error");
        
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
            showMessage("✅ Business config saved!");
        } catch (err) {
            showMessage(`Failed: ${err.message}`, "error");
        } finally {
            setSaving(false);
        }
    };

    // --- STEP 1: REQUEST OTP ---
    const handleRequestPhoneVerification = async () => {
        if (!businessPhoneInput.trim()) return showMessage("Please enter a phone number", "error");

        const phoneRegex = /^\+?[1-9]\d{1,14}$/; 
        if (!phoneRegex.test(businessPhoneInput.replace(/\s/g, ''))) {
            return showMessage("Invalid phone format. Use +XXX...", "error");
        }

        setPhoneVerificationStep('REQUESTING_CODE');
        
        try {
            const { data: response } = await client.mutations.registerPhoneNumber({
                action: 'REQUEST_PHONE_VERIFICATION',
                businessPhone: businessPhoneInput.trim(),
                businessPhoneOwner: phoneNbr
            });

            // Amplify returns the object directly (no JSON.parse needed for the response itself)
            if (response && response.success) {
                // However, check if 'data' inside response is an object or string. 
                // Based on your handler, you are returning an object.
                const innerData = response.data || {}; 
                
                setTempPhoneId(innerData.phoneNumberId); 
                setPhoneVerificationStep('WAITING_OTP');
                showMessage("✅ Code sent! Check your SMS.", "success");
            } else {
                setPhoneVerificationStep(null);
                showMessage(`Failed: ${response?.message || "Unknown error"}`, "error");
            }
        } catch (err) {
            setPhoneVerificationStep(null);
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
                businessPhone: businessPhoneInput.trim(),
                otpCode: otpCode.trim(),
                phoneNumberId: tempPhoneId, 
                businessPhoneOwner: phoneNbr
            });

            if (response && response.success) {
                const innerData = response.data || {};

                setMetaData({
                    metaBusinessAccountId: innerData.wabaId || '',
                    phoneNumber: businessPhoneInput.trim(),
                    phoneNumberId: innerData.phoneNumberId || '',
                    wabaId: innerData.wabaId || '',
                    registrationStatus: 'ACTIVE',
                    metaBusinessAccessToken: 'SYSTEM' // Managed by backend
                });

                setPhoneVerificationStep('ACTIVE');
                setOtpCode('');
                showMessage("✅ Phone registered successfully!", "success");
            } else {
                setPhoneVerificationStep('WAITING_OTP');
                showMessage(`Verification failed: ${response?.message || "Invalid OTP"}`, "error");
            }
        } catch (err) {
            setPhoneVerificationStep('WAITING_OTP');
            showMessage(`Network error: ${err.message}`, "error");
        }
    };

    // --- STEP 3: RESEND OTP ---
    const handleResendOTP = async () => {
        setPhoneVerificationStep('REQUESTING_CODE');
        try {
            const { data: response } = await client.mutations.registerPhoneNumber({
                action: 'REQUEST_PHONE_VERIFICATION',
                businessPhone: businessPhoneInput.trim(),
                businessPhoneOwner: phoneNbr
            });

            if (response && response.success) {
                setPhoneVerificationStep('WAITING_OTP');
                showMessage("✅ Code resent!", "success");
            } else {
                setPhoneVerificationStep('WAITING_OTP');
                showMessage(`Failed to resend: ${response?.message}`, "error");
            }
        } catch (err) {
            setPhoneVerificationStep('WAITING_OTP');
            showMessage(`Network error: ${err.message}`, "error");
        }
    };

    // --- STEP 4: UNREGISTER ---
    const handleUnregisterPhone = () => {
        if (!window.confirm("Disconnect this phone number?")) return;
        
        setMetaData({
            metaBusinessAccountId: '',
            metaBusinessAccessToken: '',
            phoneNumber: '',
            phoneNumberId: '',
            wabaId: '',
            registrationStatus: 'PENDING'
        });
        setBusinessPhoneInput('');
        setPhoneVerificationStep(null);
        setOtpCode('');
        showMessage("✅ View reset.", "success");
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
                        />
                    </div>

                    <div className="space-y-2 mb-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">GPS Location <span className="text-red-500">*</span></label>
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 bg-slate-900 p-3 rounded-xl text-white text-xs border border-slate-700 focus:border-sky-500 outline-none" 
                                placeholder="Latitude" 
                                value={coords.lat} 
                                onChange={e => setCoords({...coords, lat: e.target.value})} 
                            />
                            <input 
                                className="flex-1 bg-slate-900 p-3 rounded-xl text-white text-xs border border-slate-700 focus:border-sky-500 outline-none" 
                                placeholder="Longitude" 
                                value={coords.lng} 
                                onChange={e => setCoords({...coords, lng: e.target.value})} 
                            />
                        </div>
                        <button 
                            onClick={() => navigator.geolocation.getCurrentPosition(pos => setCoords({ lat: pos.coords.latitude.toString(), lng: pos.coords.longitude.toString() }))} 
                            className="w-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[10px] font-bold py-2 rounded-xl border border-sky-500/20 transition-all"
                        >
                            📍 Capture Current Location
                        </button>
                    </div>

                    <button onClick={handleUpdateBusinessConfig} disabled={saving} className="w-full py-3 rounded-xl font-black text-white bg-sky-600 hover:bg-sky-500 shadow-lg transition-all disabled:opacity-50">
                        {saving ? "SAVING..." : "SAVE BUSINESS INFO"}
                    </button>
                </div>
            </div>

            {/* 2. PHONE NUMBER REGISTRATION */}
            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700">
                <header className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-xs">W</span>
                    </div>
                    <div>
                        <h2 className="text-green-400 font-bold uppercase text-xs tracking-widest">2. WhatsApp Business Phone</h2>
                        <p className="text-[9px] text-slate-500 mt-0.5">Register your phone number with Meta</p>
                    </div>
                </header>

                {phoneVerificationStep === 'ACTIVE' ? (
                    // ACTIVE STATE
                    <div className="space-y-3">
                        <div className="text-center p-4 bg-green-900/20 rounded-lg border border-green-500/30">
                            <p className="text-green-400 text-xs font-bold mb-2">✅ WhatsApp Business Connected</p>
                            <p className="text-slate-300 text-sm font-mono font-bold mb-3">{metaData.phoneNumber}</p>
                            <div className="bg-slate-900/60 p-3 rounded border border-slate-700 space-y-2 mb-3 text-left">
                                <div><p className="text-[9px] text-slate-500"><strong>WABA ID</strong></p><p className="text-[9px] text-slate-400 font-mono break-all">{metaData.wabaId}</p></div>
                                <div><p className="text-[9px] text-slate-500 mt-2"><strong>Phone Number ID</strong></p><p className="text-[9px] text-slate-400 font-mono">{metaData.phoneNumberId}</p></div>
                            </div>
                            <button onClick={handleUnregisterPhone} className="w-full text-red-400 text-[9px] font-bold py-2 px-3 rounded border border-red-500/30 hover:bg-red-500/10 transition-all">🔄 Change Phone Number</button>
                        </div>
                    </div>
                ) : phoneVerificationStep === 'WAITING_OTP' ? (
                    // OTP ENTRY STATE
                    <div className="space-y-3">
                        <p className="text-[10px] text-slate-400 bg-blue-900/20 p-2 rounded border border-blue-500/30">📱 Verification code sent to <strong>{businessPhoneInput}</strong></p>
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-2">Enter OTP Code</label>
                            <input type="text" maxLength="6" inputMode="numeric" placeholder="000000" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-900 p-4 rounded-xl text-white text-center text-lg font-bold letter-spacing border border-slate-700 focus:ring-2 ring-green-500 outline-none" />
                        </div>
                        <button onClick={handleVerifyPhoneOTP} disabled={phoneVerificationStep === 'VERIFYING_OTP' || otpCode.length !== 6} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 py-3 rounded-lg font-bold text-white text-xs shadow-md transition-all">
                            {phoneVerificationStep === 'VERIFYING_OTP' ? "🔄 VERIFYING..." : "✓ VERIFY CODE"}
                        </button>
                        <div className="flex gap-2">
                            <button onClick={handleResendOTP} className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-lg font-bold text-white text-[9px] transition-all">📨 Resend OTP</button>
                            <button onClick={() => { setPhoneVerificationStep(null); setBusinessPhoneInput(''); setOtpCode(''); }} className="flex-1 text-slate-400 text-[9px] font-bold py-2 transition-all hover:text-slate-300">← Back</button>
                        </div>
                    </div>
                ) : phoneVerificationStep === 'REQUESTING_CODE' ? (
                    // LOADING STATE
                    <div className="text-center py-6"><p className="text-slate-400 text-xs font-bold">🔄 Sending verification code...</p></div>
                ) : (
                    // INITIAL INPUT STATE
                    <div className="space-y-3">
                        <p className="text-[10px] text-slate-400 mb-3">Enter your WhatsApp Business phone number in international format (e.g., +973XXXXXXXX).</p>
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-2">Business Phone Number <span className="text-red-500">*</span></label>
                            <input type="tel" placeholder="+973XXXXXXXX" value={businessPhoneInput} onChange={e => setBusinessPhoneInput(e.target.value)} className="w-full bg-slate-900 p-4 rounded-xl text-white border border-slate-700 focus:ring-2 ring-green-500 outline-none" />
                            <p className="text-[8px] text-slate-500 mt-1 ml-1">Format: +[country code][number]</p>
                        </div>
                        <button onClick={handleRequestPhoneVerification} disabled={!businessPhoneInput.trim()} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 py-3 rounded-lg font-bold text-white text-xs shadow-md transition-all">
                            📱 REGISTER PHONE NUMBER
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

// =========================================================
// 3️⃣ SUB-COMPONENT: BranchesSection
// =========================================================
const BranchesSection = ({ pk }) => {
    const [branchName, setBranchName] = useState('');
    const [coords, setCoords] = useState({ lat: '', lng: '' });
    const [coordError, setCoordError] = useState("");
    const [saving, setSaving] = useState(false);

    const handleCoordChange = (field, value) => {
        const isFloat = /^-?[0-9]*\.?[0-9]*$/.test(value);
        if (isFloat || value === "") {
            setCoordError("");
            setCoords(prev => ({ ...prev, [field]: value }));
        } else {
            setCoordError("Coordinates must be numeric");
        }
    };

    const handleCreateBranch = async () => {
        if (!branchName || !coords.lat || !coords.lng) return alert("All fields required");
        
        setSaving(true);
        try {
            const { data: existingBranches } = await client.models.BusinessData.listByBusiness({
                pk: pk,
                sk: { beginsWith: 'BRANCH#' }
            });

            const nextIndex = existingBranches.length + 1;
            const branchId = `BRANCH#${String(nextIndex).padStart(3, '0')}`;

            await client.models.BusinessData.create({
                pk: pk,
                sk: branchId,
                name: branchName,
                entityType: 'Branch',
                location: {
                    latitude: parseFloat(coords.lat),
                    longitude: parseFloat(coords.lng)
                }
            });

            alert(`Branch ${branchName} registered!`);
            setBranchName('');
            setCoords({ lat: '', lng: '' });
        } catch (err) {
            console.error("Branch Error:", err);
            alert("Failed to save branch.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-sm mx-auto pt-4">
            <header className="border-l-4 border-emerald-500 pl-3">
                <h2 className="text-emerald-400 font-bold uppercase text-xs tracking-widest">Branch Registration</h2>
            </header>

            <div className="space-y-5">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Branch Name</label>
                    <input 
                        className="w-full bg-slate-800 p-4 rounded-xl text-white border border-slate-700 outline-none" 
                        placeholder="e.g. Seef Mall" 
                        value={branchName}
                        onChange={e => setBranchName(e.target.value)} 
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Coordinates</label>
                    <div className="flex gap-2">
                        <input 
                            className="flex-1 bg-slate-800 p-4 rounded-xl text-white text-sm border border-slate-700 outline-none"
                            placeholder="Lat"
                            value={coords.lat}
                            onChange={e => handleCoordChange('lat', e.target.value)}
                        />
                        <input 
                            className="flex-1 bg-slate-800 p-4 rounded-xl text-white text-sm border border-slate-700 outline-none"
                            placeholder="Lng"
                            value={coords.lng}
                            onChange={e => handleCoordChange('lng', e.target.value)}
                        />
                    </div>
                </div>

                <button 
                    onClick={handleCreateBranch} 
                    disabled={saving}
                    className="w-full bg-emerald-600 py-4 rounded-xl font-black text-white shadow-lg transition-all disabled:opacity-50"
                >
                    {saving ? "SAVING..." : "REGISTER BRANCH"}
                </button>
            </div>
        </div>
    );
};

// =========================================================
// 4️⃣ SUB-COMPONENT: ItemsSection
// =========================================================
const ItemsSection = ({ pk, onUpdate }) => {
    const BASE64_HEADER = "data:image/jpeg;base64,";
    const [item, setItem] = useState({ 
        name: '', price: '', description: '', quantity: '', stockStatus: true, imageUrl: '' 
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
            const { data } = await client.models.BusinessData.listByBusiness({
                pk: pk, sk: { beginsWith: 'ITEM#' }
            });
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
    };

    const submit = async () => {
        if (!item.name.trim() || !item.price || !category.trim()) return alert("Missing fields");
        setSaving(true);
        
        const dbImageString = item.imageUrl.replace(BASE64_HEADER, '');
        const payload = {
            pk, name: item.name.trim(), unitPrice: parseFloat(item.price),
            itemCategory: category.trim().toUpperCase(), description: item.description,
            stockStatus: item.stockStatus, quantity: item.quantity ? parseInt(item.quantity) : 0,
            imageUrl: dbImageString
        };

        try {
            if (editingId) {
                await client.models.BusinessData.update({ ...payload, sk: editingId });
            } else {
                const maxId = allItems.reduce((max, i) => {
                    const num = parseInt(i.sk.split('#')[1], 10);
                    return !isNaN(num) && num > max ? num : max;
                }, 0);
                await client.models.BusinessData.create({
                    ...payload, sk: `ITEM#${String(maxId + 1).padStart(3, '0')}`, entityType: 'ITEM'
                });
            }
            await fetchItems();
            if (onUpdate) onUpdate();
            setEditingId(null);
            setItem({ name: '', price: '', description: '', quantity: '', stockStatus: true, imageUrl: '' });
            setCategory('');
        } catch (err) { alert("Error saving item"); } 
        finally { setSaving(false); }
    };

    return (
        <div className="space-y-4 max-w-sm mx-auto pt-4 animate-fade-in pb-20">
            <header className="flex justify-between items-end border-b border-indigo-500 pb-2 mb-2">
                <h2 className="text-indigo-400 font-bold uppercase text-xs tracking-widest">Menu Manager</h2>
            </header>

            {/* Name Input */}
            <div className="relative">
                <input 
                    className="w-full bg-slate-800 p-3 rounded-lg text-white border border-slate-700 outline-none text-sm"
                    placeholder="Item Name" 
                    value={item.name}
                    onChange={(e) => { setItem({...item, name: e.target.value}); if(!editingId) setShowItemSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowItemSuggestions(false), 200)}
                />
                {showItemSuggestions && filteredItems.length > 0 && (
                    <div className="absolute z-50 w-full bg-slate-800 border border-slate-600 rounded-xl mt-1 max-h-48 overflow-y-auto">
                        {filteredItems.map(s => (
                            <button key={s.sk} onMouseDown={() => selectItemToEdit(s)} className="w-full text-left px-4 py-2 text-slate-300 text-xs border-b border-slate-700">
                                {s.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Image & Category */}
            <div className="flex gap-2 items-end">
                <div className="relative w-[70px] h-[70px] bg-slate-800 rounded-lg border border-slate-700 overflow-hidden cursor-pointer">
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImageUpload} />
                    {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" alt="prev" /> : <div className="w-full h-full flex items-center justify-center text-slate-500 text-xl">+</div>}
                </div>
                <div className="flex-1 relative">
                    <input 
                        className="w-full bg-slate-800 p-3 h-[70px] rounded-lg text-white border border-slate-700 outline-none text-sm"
                        placeholder="Category" 
                        value={category}
                        onChange={(e) => { setCategory(e.target.value); setShowCatSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowCatSuggestions(false), 200)}
                    />
                    {showCatSuggestions && (
                        <div className="absolute top-full z-50 w-full bg-slate-800 border border-slate-600 rounded-xl mt-1 max-h-40 overflow-y-auto">
                            {filteredCategories.map(c => (
                                <button key={c} onMouseDown={() => { setCategory(c); setShowCatSuggestions(false); }} className="w-full text-left px-4 py-2 text-slate-300 text-xs border-b border-slate-700">
                                    {c}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Price & Qty */}
            <div className="flex gap-2">
                <input className="flex-1 bg-slate-800 p-3 rounded-lg text-white border border-slate-700 outline-none text-sm" placeholder="Price (BD)" value={item.price} onChange={e => setItem({...item, price: e.target.value})} />
                <input className="flex-1 bg-slate-800 p-3 rounded-lg text-white border border-slate-700 outline-none text-sm" type="number" placeholder="Qty" value={item.quantity} onChange={e => setItem({...item, quantity: e.target.value})} />
            </div>

            <button onClick={submit} disabled={saving} className="w-full py-3 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg">
                {saving ? "SAVING..." : (editingId ? "UPDATE ITEM" : "ADD NEW ITEM")}
            </button>
        </div>
    );
};

// =========================================================
// 5️⃣ SUB-COMPONENT: TemplatesSection
// =========================================================
const TemplatesSection = () => {
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState('');
    const [bodyText, setBodyText] = useState('');

    useEffect(() => { fetchTemplates(); }, []);

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            if (data.data) setTemplates(data.data);
        } catch (e) { console.error("API Error:", e); } 
        finally { setIsLoading(false); }
    };

    const handleCreate = async () => {
        if (!name || !bodyText) return alert("Fill all fields");
        setIsLoading(true);
        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.toLowerCase().replace(/\s/g, '_'), textBody: bodyText })
            });
            const result = await res.json();
            if (result.id) {
                alert("✅ Template Created");
                fetchTemplates();
                setName(''); setBodyText('');
            } else {
                alert("❌ Error: " + (result.error?.message || "Unknown"));
            }
        } catch (e) { alert("Network Error"); } 
        finally { setIsLoading(false); }
    };

    return (
        <div className="max-w-sm mx-auto pt-4 space-y-6 pb-24">
            <header className="border-l-4 border-purple-500 pl-3">
                <h2 className="text-purple-400 font-bold uppercase text-xs tracking-widest">Template Manager</h2>
            </header>

            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
                <input className="w-full bg-slate-900 p-3 rounded-lg text-white text-xs border border-slate-600 outline-none" placeholder="Template Name" value={name} onChange={e => setName(e.target.value)} />
                <textarea className="w-full bg-slate-900 p-3 rounded-lg text-white text-xs border border-slate-600 h-20 outline-none resize-none" placeholder="Body Text..." value={bodyText} onChange={e => setBodyText(e.target.value)} />
                <button onClick={handleCreate} disabled={isLoading} className="w-full bg-purple-600 py-3 rounded-lg font-bold text-white text-xs">
                    {isLoading ? "PROCESSING..." : "SUBMIT TO META"}
                </button>
            </div>

            <div className="space-y-2">
                {templates.map((t) => (
                    <div key={t.id} className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
                        <div>
                            <p className="text-white text-xs font-bold">{t.name}</p>
                            <p className="text-slate-500 text-[9px]">{t.status}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// =========================================================
// 6️⃣ SUB-COMPONENT: PrivacyPolicySection
// =========================================================
const PrivacyPolicySection = () => {
    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in text-slate-300 pt-2">
            <header className="border-l-4 border-emerald-500 pl-4 mb-6">
                <h2 className="text-2xl font-bold text-white">Privacy Policy</h2>
                <p className="text-xs text-emerald-400 mt-1 uppercase tracking-widest">Effective Date: January 28, 2026</p>
            </header>
            <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 shadow-xl text-sm leading-relaxed">
                <p>Welcome to CloudOrder. We respect your privacy...</p>
                {/* (Truncated for brevity, kept structure) */}
            </div>
        </div>
    );
};