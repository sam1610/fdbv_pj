
// import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
// import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// const client = new DynamoDBClient({});
// const docClient = DynamoDBDocumentClient.from(client);

// const TABLE_NAME = process.env.BUSINESS_DATA_TABLE;

// export const handler = async (event: any) => {
//     console.log("Event Arguments:", event.arguments);
//     const args = event.arguments || {}; 

//     const { 
//         businessPhone, customerPhone, customerName, favoriteItem, 
//         offerText, offerType, offerValue, imageUrl, validForHours 
//     } = args;

//     if (!businessPhone || !customerPhone) {
//         console.error("❌ Missing required arguments.");
//         return false;
//     }

//     try {
//         const formattedBusiness = businessPhone.startsWith('+') ? businessPhone : `+${businessPhone}`;
//         const cleanCustomerPhone = customerPhone.replace(/\D/g, '');
        
//         const BUSINESS_PK = `BUSINESS#${formattedBusiness}`;
//         const CUSTOMER_SK = `CUSTOMER#${formattedBusiness}#${cleanCustomerPhone}`;

//         // 1️⃣ FETCH CREDENTIALS & RESTAURANT NAME
//         const getConfigCmd = new GetCommand({
//             TableName: TABLE_NAME,
//             Key: { pk: BUSINESS_PK, sk: "CONFIG" }
//         });
//         const configResp = await docClient.send(getConfigCmd);
//         const credentials = configResp.Item;

//         if (!credentials?.accessToken || !credentials?.phoneNumberId) {
//             console.error("Missing Meta credentials for business:", formattedBusiness);
//             return false;
//         }

//         // 🟢 FIX 1: Dynamically grab the Restaurant Name from the DB Config!
//         const dynamicRestaurantName = credentials?.name || "VIP Rewards";

//         // 2️⃣ SEND WHATSAPP TEMPLATE
//         const waPayload = {
//             messaging_product: "whatsapp",
//             recipient_type: "individual",
//             to: cleanCustomerPhone, 
//             type: "template",
//             template: {
//                 // 🟢 FIX 2: Pointing to your brand new template!
//                 name: "ai_vip_offer", 
//                 language: { code: "en" },
//                 components: [
//                     { 
//                         type: "header", 
//                         parameters: [
//                             // 🟢 Injecting the dynamic name here!
//                             { type: "text", text: dynamicRestaurantName } 
//                         ] 
//                     },
//                     { 
//                         type: "body", 
//                         parameters: [
//                             { type: "text", text: customerName || "VIP" },
//                             { type: "text", text: favoriteItem },
//                             { type: "text", text: offerText }
//                         ]
//                     }
//                 ]
//             }
//         };

//         const waResponse = await fetch(`https://graph.facebook.com/v24.0/${credentials.phoneNumberId}/messages`, {
//             method: "POST",
//             headers: { 
//                 "Authorization": `Bearer ${credentials.accessToken}`, 
//                 "Content-Type": "application/json" 
//             },
//             body: JSON.stringify(waPayload)
//         });

//         const waResult = await waResponse.json();
        
//         if (waResult.error) {
//             console.error("WhatsApp API Error:", waResult.error);
//             return false;
//         }

//         console.log("✅ WhatsApp Template Sent:", waResult.messages?.[0]?.id);

//         // 3️⃣ UPDATE CUSTOMER DIGITAL WALLET
//         const expiresAt = new Date();
//         expiresAt.setHours(expiresAt.getHours() + validForHours);
//         const nowIso = new Date().toISOString(); 

//         const updateCmd = new UpdateCommand({
//             TableName: TABLE_NAME,
//             Key: { pk: BUSINESS_PK, sk: CUSTOMER_SK },
//             UpdateExpression: "SET activeOfferText = :t, activeOfferType = :type, activeOfferValue = :v, offerExpiresAt = :exp, lastOfferSentAt = :sent",
//             ExpressionAttributeValues: {
//                 ":t": offerText,
//                 ":type": offerType,
//                 ":v": offerValue,
//                 ":exp": expiresAt.toISOString(),
//                 ":sent": nowIso 
//             }
//         });

//         await docClient.send(updateCmd);
//         console.log(`✅ Digital wallet updated for ${cleanCustomerPhone}`);

//         return true;

//     } catch (error) {
//         console.error("❌ AppSync sendVipOffer Error:", error);
//         return false;
//     }
// };


import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as crypto from 'crypto'; // 🟢 Added to generate the unique flow token

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.BUSINESS_DATA_TABLE;

export const handler = async (event: any) => {
    console.log("Event Arguments:", event.arguments);
    const args = event.arguments || {}; 

    const { 
        businessPhone, customerPhone, customerName, favoriteItem, 
        offerText, offerType, offerValue, imageUrl, validForHours 
    } = args;

    if (!businessPhone || !customerPhone) {
        console.error("❌ Missing required arguments.");
        return false;
    }

    try {
        const formattedBusiness = businessPhone.startsWith('+') ? businessPhone : `+${businessPhone}`;
        const cleanCustomerPhone = customerPhone.replace(/\D/g, '');
        
        const BUSINESS_PK = `BUSINESS#${formattedBusiness}`;
        const CUSTOMER_SK = `CUSTOMER#${formattedBusiness}#${cleanCustomerPhone}`;

        // 1️⃣ FETCH CREDENTIALS & RESTAURANT NAME
        const getConfigCmd = new GetCommand({
            TableName: TABLE_NAME,
            Key: { pk: BUSINESS_PK, sk: "CONFIG" }
        });
        const configResp = await docClient.send(getConfigCmd);
        const credentials = configResp.Item;

        if (!credentials?.accessToken || !credentials?.phoneNumberId) {
            console.error("Missing Meta credentials for business:", formattedBusiness);
            return false;
        }

        const dynamicRestaurantName = credentials?.name || "VIP Rewards";

        // 🟢 GENERATE DYNAMIC FLOW TOKEN
        // This is REQUIRED so the webhook knows who is opening the menu!
        const flowToken = `flow_${crypto.randomUUID()}---ph_${cleanCustomerPhone}---biz_${formattedBusiness}---name_${encodeURIComponent(customerName || "VIP")}`;

        // 2️⃣ SEND WHATSAPP TEMPLATE
        const waPayload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanCustomerPhone, 
            type: "template",
            template: {
                // 🟢 Change this to your NEW template name (e.g., ai_vip_offer_v2)
                name: "ai_vip_offer_v2", 
                language: { code: "en" },
                components: [
                    { 
                        type: "header", 
                        parameters: [
                            { type: "text", text: dynamicRestaurantName } 
                        ] 
                    },
                    { 
                        type: "body", 
                        parameters: [
                            { type: "text", text: customerName || "VIP" },
                            { type: "text", text: favoriteItem },
                            { type: "text", text: offerText }
                        ]
                    },
                    // 🟢 THE NEW FLOW BUTTON INJECTION
                    {
                        type: "button",
                        sub_type: "flow",
                        index: "0", // Assumes the Flow button is the first/only button
                        parameters: [
                            {
                                type: "action",
                                action: {
                                    flow_token: flowToken
                                }
                            }
                        ]
                    }
                ]
            }
        };

        const waResponse = await fetch(`https://graph.facebook.com/v24.0/${credentials.phoneNumberId}/messages`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${credentials.accessToken}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify(waPayload)
        });

        const waResult = await waResponse.json();
        
        if (waResult.error) {
            console.error("WhatsApp API Error:", waResult.error);
            return false;
        }

        console.log("✅ WhatsApp Template Sent:", waResult.messages?.[0]?.id);

        // 3️⃣ UPDATE CUSTOMER DIGITAL WALLET
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + validForHours);
        const nowIso = new Date().toISOString(); 

        const updateCmd = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: BUSINESS_PK, sk: CUSTOMER_SK },
            UpdateExpression: "SET activeOfferText = :t, activeOfferType = :type, activeOfferValue = :v, offerExpiresAt = :exp, lastOfferSentAt = :sent",
            ExpressionAttributeValues: {
                ":t": offerText,
                ":type": offerType,
                ":v": offerValue,
                ":exp": expiresAt.toISOString(),
                ":sent": nowIso 
            }
        });

        await docClient.send(updateCmd);
        console.log(`✅ Digital wallet updated for ${cleanCustomerPhone}`);

        return true;

    } catch (error) {
        console.error("❌ AppSync sendVipOffer Error:", error);
        return false;
    }
};