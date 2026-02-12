import { Schema } from "../../data/resource"; // Import Schema type to type the handler arguments

// ============================================================
// 1. CONFIGURATION & HELPERS
// ============================================================
const WABA_ID = process.env.WABA_ID;
const SYSTEM_TOKEN = process.env.META_SYSTEM_USER_TOKEN;
const APPSYNC_URL = process.env.APPSYNC_ENDPOINT_URL;
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY;

// Helper: Parse "+97333..." into { cc: "973", number: "33..." }
function parsePhoneNumber(phone: string) {
    const clean = phone.replace(/\D/g, ''); // Remove non-digits
    
    if (clean.startsWith('973')) return { cc: '973', number: clean.substring(3) };
    if (clean.startsWith('1')) return { cc: '1', number: clean.substring(1) };
    if (clean.startsWith('44')) return { cc: '44', number: clean.substring(2) };
    
    // Fallback: Assume first 3 digits are CC
    return { cc: clean.substring(0, 3), number: clean.substring(3) };
}

// Helper: Self-contained AppSync Request
async function appSyncRequest(query: string, variables: any) {
    if (!APPSYNC_URL || !APPSYNC_API_KEY) throw new Error("Missing AppSync Environment Variables");
    
    const req = new Request(APPSYNC_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': APPSYNC_API_KEY
        },
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

// Helper: Meta API Request
// Make body optional with '?'
async function callMeta(endpoint: string, method: string, body?: any) {
    const url = `https://graph.facebook.com/v19.0${endpoint}`;
    
    // Define options with explicit type allowing body
    const opts: RequestInit = {
        method,
        headers: { 
            "Authorization": `Bearer ${SYSTEM_TOKEN}`, 
            "Content-Type": "application/json" 
        }
    };
    
    if (body) {
        opts.body = JSON.stringify(body);
    }
    
    const res = await fetch(url, opts);
    return await res.json();
}

// ============================================================
// 2. CORE LOGIC
// ============================================================

// STEP A: Add Phone to WABA to get ID
async function getPhoneNumberId(businessPhone: string) {
    const { cc, number } = parsePhoneNumber(businessPhone);

    // 1. Try to ADD the phone
    const res = await callMeta(`/${WABA_ID}/phone_numbers`, 'POST', {
        cc: cc,
        phone_number: number,
        display_name: "CloudOrder Merchant"
    });

    if (res.id) return res.id;

    // 2. If error is "Already exists", FIND the ID
    if (res.error) {
        console.log("Phone might exist, searching list...", res.error.message);
        
        // Fetch list of all phones in WABA (GET doesn't need a body)
        const listRes = await callMeta(`/${WABA_ID}/phone_numbers?fields=display_phone_number,id`, 'GET');
        
        // Match clean numbers
        const targetClean = businessPhone.replace(/\D/g, '');
        const match = listRes.data?.find((p: any) => p.display_phone_number.replace(/\D/g, '') === targetClean);
        
        if (match) return match.id;
    }
    
    throw new Error(res.error?.message || "Could not register phone with Meta");
}

// ============================================================
// 3. LAMBDA HANDLER
// ============================================================

// Define the event type based on your schema args
type RegisterPhoneEvent = {
    arguments: {
        action: string;
        businessPhone: string;
        otpCode?: string | null;
        businessPhoneOwner?: string | null;
        phoneNumberId?: string | null;
    }
};

export const handler: Schema["registerPhoneNumber"]["functionHandler"] = async (event) => {
    // Explicitly cast event arguments
    const { action, businessPhone, otpCode, businessPhoneOwner, phoneNumberId } = event.arguments;

    try {
        if (!businessPhone) throw new Error("Missing Business Phone");

        // --- REQUEST OTP ---
        if (action === "REQUEST_PHONE_VERIFICATION") {
            const phoneId = await getPhoneNumberId(businessPhone);
            
            const otpRes = await callMeta(`/${phoneId}/request_code`, 'POST', {
                code_method: "SMS",
                language: "en"
            });

            if (otpRes.success) {
                return { 
                    success: true, 
                    message: "OTP Sent", 
                    data: JSON.stringify({ phoneNumberId: phoneId }) 
                };
            }
            throw new Error(otpRes.error?.message || "Failed to send SMS");
        }

        // --- VERIFY OTP ---
        if (action === "VERIFY_PHONE_OTP") {
            const phoneId = phoneNumberId || await getPhoneNumberId(businessPhone);

            const verifyRes = await callMeta(`/${phoneId}/verify_code`, 'POST', {
                code: otpCode
            });

            if (!verifyRes.success) throw new Error("Invalid OTP Code");

            // Save to DB
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

            const mutation = `
                mutation SaveMeta($input: CreateRestaurantMetaAccountInput!) {
                    createRestaurantMetaAccount(input: $input) { restaurantId }
                }
            `;
            
            await appSyncRequest(mutation, { input });

            return { 
                success: true, 
                message: "Phone Verified & Registered",
                data: JSON.stringify({ wabaId: WABA_ID, phoneNumberId: phoneId })
            };
        }

        return { success: false, message: "Unknown Action", data: null };

    } catch (error) {
        console.error("Handler Error:", error);
        // Type assertion for unknown error
        const errorMessage = (error as Error).message || "Unknown Error";
        return { success: false, message: errorMessage, data: null };
    }
};