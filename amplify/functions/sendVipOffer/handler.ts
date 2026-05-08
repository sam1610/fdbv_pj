// amplify/functions/sendVipOffer/handler.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Ensure this matches your actual table name environment variable in Amplify Gen 2
const TABLE_NAME = process.env.AMPLIFY_DATA_BUSINESSDATA_TABLE_NAME || process.env.BusinessDataTableName;

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
                name: "vip_favorite_item", 
                language: { code: "en" },
                components: [
                    { type: "header", parameters: [{ type: "image", image: { link: imageUrl } }] },
                    { type: "body", parameters: [
                        { type: "text", text: customerName || "VIP" },
                        { type: "text", text: favoriteItem },
                        { type: "text", text: offerText }
                    ]}
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

        const updateCmd = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: BUSINESS_PK, sk: CUSTOMER_SK },
            UpdateExpression: "SET activeOfferText = :t, activeOfferType = :type, activeOfferValue = :v, offerExpiresAt = :exp",
            ExpressionAttributeValues: {
                ":t": offerText,
                ":type": offerType,
                ":v": offerValue,
                ":exp": expiresAt.toISOString()
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