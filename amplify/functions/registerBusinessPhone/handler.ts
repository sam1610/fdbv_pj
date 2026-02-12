import { Schema } from "../../data/resource"; 

// ============================================================
// 1. CONFIGURATION & HELPERS
// ============================================================
// ✅ FIX 1: Trim whitespace to prevent "Invalid Parameter" from copy-paste errors
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

async function callMeta(endpoint: string, method: string, body?: any) {
    const url = `https://graph.facebook.com/v19.0${endpoint}`;
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

async function getPhoneNumberId(businessPhone: string) {
    const { cc, number } = parsePhoneNumber(businessPhone);

    console.log(`Trying to register: ${cc} ${number} to WABA: ${WABA_ID}`);

    // ✅ FIX 2: Added 'verified_name' which is REQUIRED by Meta v19+
    const res = await callMeta(`/${WABA_ID}/phone_numbers`, 'POST', {
        cc: cc,
        phone_number: number,
        display_name: "CloudOrder Merchant",
        verified_name: "CloudOrder Merchant" 
    });

    if (res.id) return res.id;

    if (res.error) {
        console.log("Registration failed, checking if exists...", res.error.message);
        
        // Fetch list to see if it's already there
        const listRes = await callMeta(`/${WABA_ID}/phone_numbers?fields=display_phone_number,id,verified_name`, 'GET');
        
        const targetClean = businessPhone.replace(/\D/g, '');
        const match = listRes.data?.find((p: any) => p.display_phone_number.replace(/\D/g, '') === targetClean);
        
        if (match) {
            console.log("Found existing phone ID:", match.id);
            return match.id;
        }
    }
    
    // Throw the original error if we couldn't recover
    throw new Error(res.error?.message || "Could not register phone with Meta");
}

// ============================================================
// 3. LAMBDA HANDLER
// ============================================================
export const handler: Schema["registerPhoneNumber"]["functionHandler"] = async (event) => {
    const { action, businessPhone, otpCode, businessPhoneOwner, phoneNumberId } = event.arguments;

    try {
        if (!businessPhone) throw new Error("Missing Business Phone");

        if (action === "REQUEST_PHONE_VERIFICATION") {
            const phoneId = await getPhoneNumberId(businessPhone);
            const otpRes = await callMeta(`/${phoneId}/request_code`, 'POST', { code_method: "SMS", language: "en" });

            if (otpRes.success) {
                return { success: true, message: "OTP Sent", data: JSON.stringify({ phoneNumberId: phoneId }) };
            }
            throw new Error(otpRes.error?.message || "Failed to send SMS");
        }

        if (action === "VERIFY_PHONE_OTP") {
            const phoneId = phoneNumberId || await getPhoneNumberId(businessPhone);
            const verifyRes = await callMeta(`/${phoneId}/verify_code`, 'POST', { code: otpCode });

            if (!verifyRes.success) throw new Error("Invalid OTP Code");

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

            return { success: true, message: "Phone Verified", data: JSON.stringify({ wabaId: WABA_ID, phoneNumberId: phoneId }) };
        }

        return { success: false, message: "Unknown Action", data: null };

    } catch (error) {
        console.error("Handler Error:", error);
        const errorMessage = (error as Error).message || "Unknown Error";
        return { success: false, message: errorMessage, data: null };
    }
};