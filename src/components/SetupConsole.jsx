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
    const [otpAttempts, setOtpAttempts] = useState(0); // 🟢 Track failures

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
            
            // 🟢 Check for existing UI Locks
            const lockTime = localStorage.getItem(`meta_lock_${phoneNbr}`);
            if (lockTime && (Date.now() - parseInt(lockTime) < 2 * 60 * 60 * 1000)) {
                setPhoneVerificationStep('PENDING_REVIEW');
            }
            
            // 🟢 Check OTP Failures
            const savedAttempts = parseInt(localStorage.getItem(`otp_attempts_${phoneNbr}`) || "0");
            setOtpAttempts(savedAttempts);
            if (savedAttempts >= 2) {
                setPhoneVerificationStep('LOCKED_OUT'); // Lock out immediately if history shows >= 2
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

    const handleUpdateBusinessConfig = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) return showMessage("Please fill in Business Name", "error");

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

            if (response.data?.success) {
                const innerData = response.data.data ? JSON.parse(response.data.data) : {};
                if (innerData.phoneNumberId) setTempPhoneId(innerData.phoneNumberId);
                
                setPhoneVerificationStep('WAITING_OTP');
                showMessage(`Code sent via ${verificationMethod}!`, "success");
            } else {
                setPhoneVerificationStep(null);
                showMessage(`Failed: ${response.data?.message || "Check Browser Console"}`, "error");
            }
        } catch (err) {
            setPhoneVerificationStep(null);
            showMessage(`Network error: ${err.message}`, "error");
        }
    };

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
                
                setMetaData({
                    metaBusinessAccountId: innerData.wabaId || '',
                    phoneNumber: phoneNbr,
                    phoneNumberId: innerData.phoneNumberId || '',
                    wabaId: innerData.wabaId || '',
                    registrationStatus: 'ACTIVE',
                    assignedPin: innerData.assignedPin || ''
                });

                try {
                     await client.models.RestaurantMetaAccount.create({
                        restaurantId: phoneNbr,
                        metaBusinessAccessToken: innerData.accessToken || process.env.REACT_APP_META_SYSTEM_USER_TOKEN,
                        phoneNumberId: innerData.phoneNumberId,
                        wabaId: innerData.wabaId,
                        phoneNumber: phoneNbr,
                        registrationStatus: 'ACTIVE'
                    });
                } catch (dbErr) { console.error("Failed to save credentials to DB:", dbErr); }

                localStorage.removeItem(`otp_attempts_${phoneNbr}`); // Clear fails on success
                setPhoneVerificationStep('ACTIVE');
                setOtpCode('');
                showMessage("✅ Phone securely registered to WhatsApp API!", "success");
            }
            else if (response && response.message === "PENDING_META_REVIEW") {
                setPhoneVerificationStep('PENDING_REVIEW');
            }
            else {
                // 🟢 HANDLE FAILURES & ENFORCE 2-TRY LIMIT
                const newAttempts = otpAttempts + 1;
                setOtpAttempts(newAttempts);
                localStorage.setItem(`otp_attempts_${phoneNbr}`, newAttempts);

                if (newAttempts >= 2) {
                    setPhoneVerificationStep('LOCKED_OUT');
                    showMessage("Maximum verification attempts reached.", "error");
                } else {
                    setPhoneVerificationStep('WAITING_OTP');
                    showMessage(`Verification failed. You have ${2 - newAttempts} attempt left.`, "error");
                }
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
                            disabled={phoneVerificationStep === 'ACTIVE'}
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
                    <div className="space-y-3">
                        <div className="text-center p-4 bg-green-900/20 rounded-lg border border-green-500/30">
                            <p className="text-green-400 text-xs font-bold mb-2">✅ WhatsApp Business Connected</p>
                            <p className="text-white font-mono font-bold text-lg mb-3">{metaData.phoneNumber || phoneNbr}</p>
                            <div className="bg-slate-900/60 p-3 rounded border border-slate-700 space-y-3 text-left">
                                <div>
                                    <p className="text-[9px] text-slate-500"><strong>PHONE NUMBER ID</strong></p>
                                    <p className="text-[9px] text-slate-400 font-mono break-all">{metaData.phoneNumberId || 'Verified'}</p>
                                </div>
                                {metaData.assignedPin && (
                                    <div className="pt-2 border-t border-slate-700">
                                        <p className="text-[9px] text-slate-500"><strong>WHATSAPP API PIN</strong></p>
                                        <p className="text-[11px] text-emerald-400 font-mono font-bold tracking-widest">{metaData.assignedPin}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                ) : phoneVerificationStep === 'LOCKED_OUT' ? (
                    // 🟢 NEW: The Locked Out State
                    <div className="space-y-3">
                        <div className="text-center p-5 bg-red-900/20 rounded-xl border border-red-500/30 shadow-inner">
                            <div className="w-10 h-10 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-3">
                                <span className="text-red-500 text-lg">⚠️</span>
                            </div>
                            <p className="text-red-400 text-sm font-black mb-2 uppercase tracking-wide">Registration Locked</p>
                            <p className="text-[11px] text-slate-300 mb-4 leading-relaxed">
                                You have exceeded the maximum allowed verification attempts. Meta requires a cooldown period to prevent spam.
                            </p>
                            <button 
                                onClick={() => window.open('https://your-custom-chat-link.com', '_blank')} 
                                className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-bold text-white text-xs shadow-md transition-all border border-slate-500"
                            >
                                💬 CONTACT CUSTOMER SUPPORT
                            </button>
                        </div>
                    </div>

                ) : phoneVerificationStep === 'PENDING_REVIEW' ? (
                    <div className="space-y-3">
                        <div className="text-center p-5 bg-yellow-900/20 rounded-xl border border-yellow-500/30 shadow-inner">
                            <div className="w-10 h-10 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center mb-3">
                                <span className="text-yellow-500 text-lg">⏳</span>
                            </div>
                            <p className="text-yellow-400 text-sm font-black mb-2 uppercase tracking-wide">Pending Meta Approval</p>
                            <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                                Meta is currently reviewing your Business Name ("<strong>{name}</strong>").
                            </p>
                            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 mb-3">
                                <p className="text-[10px] text-slate-400">
                                    This automated review takes <strong>1 to 24 hours</strong>. The connection button has been disabled for 2 hours to protect your account.
                                </p>
                            </div>
                        </div>
                    </div>

                ) : phoneVerificationStep === 'WAITING_OTP' ? (
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

                ) : (
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