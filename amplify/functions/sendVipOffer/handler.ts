import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import * as crypto from 'crypto'; 

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

        // 2️⃣ FETCH MENU CATEGORIES TO INJECT INTO FLOW
        // Because the Template Button opens the Flow locally, it needs the categories immediately!
        const menuCmd = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
            ExpressionAttributeValues: {
                ":pk": BUSINESS_PK,
                ":sk": "ITEM#"
            }
        });
        const menuResp = await docClient.send(menuCmd);
        const items = menuResp.Items || [];
        const uniqueCats = [...new Set(items.map(i => i.itemCategory).filter(Boolean))].sort();
        
        const categoriesList = uniqueCats.length > 0 
            ? uniqueCats.map(c => ({ id: c, title: c }))
            : [{ id: "EMPTY", title: "No Menu Available" }];

        // Prepare the exact data the first screen expects
        const flowActionData = {
            menu_title: `${dynamicRestaurantName} 🍽️ Menu`,
            categories_list: categoriesList,
            cart_summary: "🛒 Cart: 0 items",
            can_finalize: false,
            cart_items: [],
            footer_label: "View Items",
            vip_alert: `⭐ **VIP Alert:** Enjoy ${offerValue}% off your entire order today!`,
            show_vip_alert: true,
            default_category: ""
        };

        // 3️⃣ GENERATE DYNAMIC FLOW TOKEN
        const flowToken = `flow_${crypto.randomUUID()}---ph_${cleanCustomerPhone}---biz_${formattedBusiness}---name_${encodeURIComponent(customerName || "VIP")}`;

        // 4️⃣ SEND WHATSAPP TEMPLATE
        const waPayload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanCustomerPhone, 
            type: "template",
            template: {
                name: "ai_vip_offer_v2", // ⚠️ MAKE SURE THIS MATCHES YOUR META TEMPLATE NAME
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
                    {
                        type: "button",
                        sub_type: "flow",
                        index: "0",
                        parameters: [
                            {
                                type: "action",
                                action: {
                                    flow_token: flowToken,
                                    flow_action_data: flowActionData // 🟢 INJECTS DATA DIRECTLY INTO SCREEN
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

        // 5️⃣ UPDATE CUSTOMER DIGITAL WALLET
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