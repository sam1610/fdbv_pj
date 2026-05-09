import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const dbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrockClient = new BedrockRuntimeClient({}); 
const TABLE_NAME = process.env.BUSINESS_DATA_TABLE;

export const handler = async (event: any) => {
    const isScheduled = event.source === 'aws.events' || !event.arguments || Object.keys(event.arguments).length === 0;
    let { businessPhone, minSpent, minOrders, churnDaysMin, churnDaysMax } = event.arguments || {};

    if (!businessPhone) {
        businessPhone = "+97317620635"; 
    }

    const formattedBusiness = businessPhone.startsWith('+') ? businessPhone : `+${businessPhone}`;
    const BUSINESS_PK = `BUSINESS#${formattedBusiness}`;
    const SETTINGS_SK = `MARKETING_SETTINGS`;
    const CACHE_SK = `CACHE#AI_RECOMMENDATIONS`;

    try {
        console.log(`🚀 Starting AI Generation for ${formattedBusiness}. Triggered via: ${isScheduled ? 'SCHEDULE' : 'UI'}`);

        // 1️⃣ FETCH ADMIN SETTINGS 
        if (!minSpent) {
            const { Item: settingsItem } = await dbClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: BUSINESS_PK, sk: SETTINGS_SK }
            }));
            
            if (settingsItem && settingsItem.location) {
                try {
                    const parsed = typeof settingsItem.location === 'string' 
                        ? JSON.parse(settingsItem.location) 
                        : settingsItem.location;
                    
                    minSpent = Number(parsed.minSpent) || 20;
                    minOrders = Number(parsed.minOrders) || 3;
                    churnDaysMin = Number(parsed.churnDaysMin) || 7;
                    churnDaysMax = Number(parsed.churnDaysMax) || 20;
                } catch (e) {
                    console.error("Error parsing marketing settings", e);
                }
            } else {
                minSpent = 20; minOrders = 3; churnDaysMin = 7; churnDaysMax = 20;
            }
        }
        
        console.log(`⚙️ Using Rules -> MinSpent: ${minSpent}, MinOrders: ${minOrders}, Churn Window: ${churnDaysMin}-${churnDaysMax} days`);

        const now = new Date().getTime();

        // 2️⃣ CHECK CACHE (ONLY IF MANUALLY TRIGGERED)
        if (!isScheduled) {
            const { Item: cacheData } = await dbClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk: BUSINESS_PK, sk: CACHE_SK }
            }));

            const TWELVE_HOURS = 12 * 60 * 60 * 1000;
            if (cacheData && cacheData.timestamp && (now - cacheData.timestamp < TWELVE_HOURS)) {
                console.log("🟢 Returning Cached AI Results to UI to save cost.");
                const cachedList = JSON.parse(cacheData.recommendations);
                
                const { Items: liveCustomers } = await dbClient.send(new QueryCommand({
                    TableName: TABLE_NAME,
                    KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
                    ExpressionAttributeValues: { ":pk": BUSINESS_PK, ":skPrefix": "CUSTOMER#" }
                }));
                
                const eligiblePhones = (liveCustomers || [])
                    .filter(c => !c.activeOfferType)
                    .map(c => c.phone);
                    
                return cachedList.filter((aiRec: any) => eligiblePhones.includes(aiRec.phone));
            }
        }

        // 3️⃣ FETCH ALL LIVE CUSTOMERS 
        const { Items: allCustomers } = await dbClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
            ExpressionAttributeValues: { ":pk": BUSINESS_PK, ":skPrefix": "CUSTOMER#" }
        }));

        console.log(`📊 Scanned ${allCustomers?.length || 0} total customers in database.`);

        if (!allCustomers || allCustomers.length === 0) return [];

        // 4️⃣ FILTER: Apply RFM Rules
        const qualifiedVIPs = allCustomers.filter(c => {
            if (!c.acceptsMarketing) return false;
            if (c.activeOfferType) return false; 
            
            if (c.lastOfferSentAt) {
                const daysSinceLastOffer = Math.floor((now - new Date(c.lastOfferSentAt).getTime()) / (1000 * 3600 * 24));
                if (daysSinceLastOffer < 30) return false; 
            }

            if ((c.totalAmount || 0) < minSpent) return false;
            if ((c.orderCount || 0) < minOrders) return false;
            
            if (!c.lastOrderDate) return false;
            const daysAbsent = Math.floor((now - new Date(c.lastOrderDate).getTime()) / (1000 * 3600 * 24));
            
            if (daysAbsent < churnDaysMin || daysAbsent > churnDaysMax) return false;
            
            c.daysAbsent = daysAbsent;
            return true;
        });

        console.log(`🎯 ${qualifiedVIPs.length} customers passed all strict RFM rules.`);

        if (qualifiedVIPs.length === 0) {
            console.log("⚠️ No VIPs matched the criteria. Saving empty cache and exiting.");
            await dbClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: { pk: BUSINESS_PK, sk: CACHE_SK, entityType: "AICache", timestamp: now, recommendations: "[]" }
            }));
            return [];
        }

        console.log(`🤖 Triggering Claude 3.5 Sonnet to generate marketing strategies...`);

        // 5️⃣ PREPARE THE AI PAYLOAD
        const aiInputData = qualifiedVIPs.map(c => ({
            phone: c.phone,
            name: c.name,
            favoriteItem: c.favoriteItem || "Meal",
            totalSpent: c.totalAmount,
            daysAbsent: c.daysAbsent
        }));

        const prompt = `You are an expert restaurant marketing AI. Analyze this JSON array of at-risk VIP customers:
        ${JSON.stringify(aiInputData)}
        
        For each customer, recommend the best win-back offer. 
        Rules:
        1. Choose 'recommendedOfferType' as either "PERCENTAGE" (between 10 and 20) or "FREE_ITEM".
        2. If they are a low spender, prefer a FREE_ITEM. If they are a high spender, prefer PERCENTAGE.
        3. Write a short 'recommendedOfferText' (e.g., "a 15% discount on your entire order" or "a Free Cola").
        4. Write a 1-sentence 'reasoning' explaining your choice.
        
        Return strictly a valid JSON array matching the input structure, adding your recommendation fields. No markdown formatting.`;

        const command = new InvokeModelCommand({
            modelId: "anthropic.claude-3-sonnet-20240229-v1:0", 
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 1000,
                messages: [{ role: "user", content: prompt }]
            })
        });

        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        let aiResultText = responseBody.content[0].text;
        
        aiResultText = aiResultText.replace(/```json/g, '').replace(/```/g, '').trim();
        const finalRecommendations = JSON.parse(aiResultText);

        console.log(`✅ Successfully generated and parsed AI recommendations.`);

        // 6️⃣ SAVE TO CACHE
        await dbClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                pk: BUSINESS_PK,
                sk: CACHE_SK,
                entityType: "AICache",
                timestamp: now,
                recommendations: JSON.stringify(finalRecommendations)
            }
        }));

        return finalRecommendations;

    } catch (e) {
        console.error("❌ AI Recommendation Error:", e);
        return [];
    }
};