// amplify/functions/sendVipOffer/handler.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// 🟢 FIX: Look for the exact environment variable we injected in backend.ts
const TABLE_NAME = process.env.BUSINESS_DATA_TABLE;

export const handler = async (event: any) => {
    console.log("Event Arguments:", event.arguments);
    const { 
        businessPhone, customerPhone, customerName, favoriteItem, 
        offerText, offerType, offerValue, imageUrl, validForHours 
    } = event.arguments;

    try {
        const formattedBusiness = businessPhone.startsWith('+') ? businessPhone : `+${businessPhone}`;
        const cleanCustomerPhone = customerPhone.replace(/\D/g, '');
        
        const BUSINESS_PK = `BUSINESS#${formattedBusiness}`;
        const CUSTOMER_SK = `CUSTOMER#${formattedBusiness}#${cleanCustomerPhone}`;

        // 1️⃣ FETCH CREDENTIALS DIRECTLY FROM DYNAMODB
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

        // 2️⃣ SEND WHATSAPP TEMPLATE (Self-contained fetch)
        const waPayload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanCustomerPhone, 
            type: "template",
            template: {
                name: "vip_favorite_item", // You kept the same name, so we leave this
                language: { code: "en" },
                components: [
                    { 
                        type: "header", 
                        parameters: [
                            // 🟢 This fills the {{1}} in your new Text Header
                            // I am using the business name from your Meta screenshot
                            { type: "text", text: "1st-Hub-IT" } 
                        ] 
                    },
                    { 
                        type: "body", 
                        parameters: [
                            // 🟢 These fill the {{1}}, {{2}}, {{3}} in your Body
                            { type: "text", text: customerName || "VIP" },
                            { type: "text", text: favoriteItem },
                            { type: "text", text: offerText }
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
        const nowIso = new Date().toISOString(); // 🟢 Get current time

        const updateCmd = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: BUSINESS_PK, sk: CUSTOMER_SK },
            // 🟢 Add lastOfferSentAt to the UpdateExpression
            UpdateExpression: "SET activeOfferText = :t, activeOfferType = :type, activeOfferValue = :v, offerExpiresAt = :exp, lastOfferSentAt = :sent",
            ExpressionAttributeValues: {
                ":t": offerText,
                ":type": offerType,
                ":v": offerValue,
                ":exp": expiresAt.toISOString(),
                ":sent": nowIso // 🟢 Stamp the record!
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