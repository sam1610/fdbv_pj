import { Schema } from "../../data/resource"; 

// ============================================================
// 1. CONFIGURATION & HELPERS
// ============================================================
const WABA_ID = process.env.WABA_ID ? process.env.WABA_ID.trim() : "";
const SYSTEM_TOKEN = process.env.META_SYSTEM_USER_TOKEN ? process.env.META_SYSTEM_USER_TOKEN.trim() : "";
const APPSYNC_URL = process.env.APPSYNC_ENDPOINT_URL;
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY;

function parsePhoneNumber(phone: string) {
    const clean = phone.replace(/\D/g, ''); 
    if (clean.startsWith('973')) return { cc: '973', number: clean.substring(3) };
    if (clean.startsWith('1')) return { cc: '1', number: clean.substring(1) };
    if (clean.startsWith('44')) return { cc: '44', number: clean.substring(2) };
    return { cc: clean.substring(0, 3), number: clean.substring(3) };
}

// ✅ NEW: Generates a random 6-digit PIN for Meta registration
function generateRandomPin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function appSyncRequest(query: string, variables: any) {
    if (!APPSYNC_URL || !APPSYNC_API_KEY) throw new Error("Missing AppSync Environment Variables");
    const req = new Request(APPSYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': APPSYNC_API_KEY },
        body: JSON.stringify({ query, variables })
    });
    const res = await fetch(req);
    const json = await res.json();
    if (json.errors) {
        console.error("AppSync Errors:", JSON.stringify(json.errors));
        throw new Error(json.errors[0].message);
    }
    return json.data;
}

// Note: Upgraded to v23.0 to align with Meta's current API deprecation schedule
async function callMeta(endpoint: string, method: string, body?: any) {
    const url = `https://graph.facebook.com/v23.0${endpoint}`;
    const opts: RequestInit = {
        method,
        headers: { "Authorization": `Bearer ${SYSTEM_TOKEN}`, "Content-Type": "application/json" }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    return await res.json();
}

// ============================================================
// 2. CORE LOGIC
// ============================================================

async function getPhoneNumberId(businessPhone: string, businessName?: string | null) {
    const { cc, number } = parsePhoneNumber(businessPhone);

    console.log(`Trying to register: ${cc} ${number} to WABA: ${WABA_ID} as ${businessName}`);

    const res = await callMeta(`/${WABA_ID}/phone_numbers`, 'POST', {
        cc: cc,
        phone_number: number,
        verified_name: businessName || "CloudOrder Merchant" 
    });

    if (res.id) return res.id;

    if (res.error) {
        console.error("Registration failed:", JSON.stringify(res.error));
        
        const listRes = await callMeta(`/${WABA_ID}/phone_numbers?fields=display_phone_number,id,verified_name`, 'GET');
        const targetClean = businessPhone.replace(/\D/g, '');
        const match = listRes.data?.find((p: any) => p.display_phone_number.replace(/\D/g, '') === targetClean);
        
        if (match) {
            console.log("Found existing phone ID:", match.id);
            return match.id;
        }
        
        throw new Error(res.error?.error_user_msg || res.error?.message || "Could not register phone with Meta");
    }
    
    throw new Error("Could not register phone with Meta");
}

// ============================================================
// 3. LAMBDA HANDLER
// ============================================================
export const handler: Schema["registerPhoneNumber"]["functionHandler"] = async (event) => {
    const { action, businessPhone, otpCode, businessPhoneOwner, phoneNumberId, verificationMethod, businessName } = event.arguments;    
    
    try {
        if (!businessPhone) throw new Error("Missing Business Phone");

        if (action === "REQUEST_PHONE_VERIFICATION") {
            const phoneId = await getPhoneNumberId(businessPhone, businessName);
            
            const method = verificationMethod === "VOICE" ? "VOICE" : "SMS";
            console.log(`Requesting OTP via ${method} for ${businessPhone}`);
            
            const otpRes = await callMeta(`/${phoneId}/request_code`, 'POST', { 
                code_method: method, 
                language: "en" 
            });

            if (otpRes.success) {
                return { success: true, message: `OTP Sent via ${method}`, data: JSON.stringify({ phoneNumberId: phoneId }) };
            }

            // ✅ NEW: Catch Meta's specific rate limit or review blocks
            if (otpRes.error?.error_user_msg?.includes("already in progress") || otpRes.error?.error_user_msg?.includes("1 hour")) {
                 return { success: false, message: "PENDING_META_REVIEW", data: otpRes.error.error_user_msg };
            }

            throw new Error(otpRes.error?.error_user_msg || otpRes.error?.message || "Failed to send OTP");
        }

        if (action === "VERIFY_PHONE_OTP") {
            const phoneId = phoneNumberId || await getPhoneNumberId(businessPhone, businessName);
            
            // 1. Verify the OTP
            const verifyRes = await callMeta(`/${phoneId}/verify_code`, 'POST', { code: otpCode });
            if (!verifyRes.success) throw new Error(verifyRes.error?.error_user_msg || "Invalid OTP Code");

            // ✅ NEW: 2. Automatically Register the PIN
            const generatedPin = generateRandomPin();
            console.log(`Registering phone ID ${phoneId} with auto-generated PIN: ${generatedPin}`);
            
            const pinRes = await callMeta(`/${phoneId}/register`, 'POST', {
                messaging_product: "whatsapp",
                pin: generatedPin
            });

            if (!pinRes.success) {
                console.error("PIN Registration Error:", JSON.stringify(pinRes.error));
                throw new Error(pinRes.error?.error_user_msg || "OTP verified, but failed to activate PIN with Meta.");
            }
            // ✅ THE MISSING FIX: Bind the AWS Public Key to the new Phone Number ID
const publicKey = process.env.PUBLIC_KEY ? process.env.PUBLIC_KEY.trim() : "";
if (publicKey) {
    console.log(`Binding AWS Public Key to new phone ID ${phoneId}`);
    
    // Must use x-www-form-urlencoded format for this specific Meta endpoint
    const encodedKey = encodeURIComponent(publicKey);
    const keyRes = await fetch(`https://graph.facebook.com/v23.0/${phoneId}/whatsapp_business_encryption`, {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${SYSTEM_TOKEN}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `business_public_key=${encodedKey}`
    });
    
    const keyJson = await keyRes.json();
    if (!keyJson.success) {
        console.error("⚠️ Key Binding Failed (Flows will not work):", JSON.stringify(keyJson));
        // You may want to throw an error here depending on how strict you want the onboarding to be
    } else {
        console.log(`✅ Public Key successfully bound to ${phoneId}`);
    }
}

            // 3. Save to AppSync
            const input = {
                restaurantId: businessPhone,
                metaBusinessAccessToken: SYSTEM_TOKEN, 
                phoneNumberId: phoneId,
                phoneNumber: businessPhone,
                wabaId: WABA_ID,
                registrationStatus: "ACTIVE",
                businessOwnerId: businessPhoneOwner,
                registrationDate: new Date().toISOString(), 
                lastVerified: new Date().toISOString()
            };

            const mutation = `mutation SaveMeta($input: CreateRestaurantMetaAccountInput!) { createRestaurantMetaAccount(input: $input) { restaurantId } }`;
            await appSyncRequest(mutation, { input });

            // Pass the PIN back in the payload just in case the UI or backend ever needs it
            const payload = { wabaId: WABA_ID, phoneNumberId: phoneId, assignedPin: generatedPin };
            return { success: true, message: "Phone Verified and Registered", data: JSON.stringify(payload) };
        }

        return { success: false, message: "Unknown Action", data: null };

    } catch (error) {
        console.error("Handler Error:", error);
        const errorMessage = (error as Error).message || "Unknown Error";

        // ✅ NEW: Global catch for Meta's manual review error string
        if (errorMessage.includes("Display name verification is already in progress") || errorMessage.includes("Verification already in progress")) {
            return { success: false, message: "PENDING_META_REVIEW", data: errorMessage };
        }

        return { success: false, message: errorMessage, data: null };
    }
};