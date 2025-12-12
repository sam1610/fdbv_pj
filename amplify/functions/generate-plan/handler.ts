import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// Initialize Clients
const ddb = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });

interface HandlerEvent {
  arguments: {
    targetDate: string;
    category: string;
    businessPhone: string;
  };
}

interface SalesAccumulator {
  [date: string]: number;
}

export const handler = async (event: HandlerEvent) => {
  console.log("EVENT RECEIVED:", JSON.stringify(event));
  
  const { targetDate, category } = event.arguments;
  const tableName = process.env.AMPLIFY_DATA_TABLE_NAME;

  if (!tableName) throw new Error("Missing Table Name environment variable");

  let salesStats: SalesAccumulator = {};
  let totalSold = 0;
  let avgDaily = 0;

  try {
    // ====================================================
    // 1. DATA FETCHING (UPDATED TO 30 DAYS)
    // ====================================================
    
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30); // Look back 30 days
    const dateThreshold = pastDate.toISOString();

    const command = new QueryCommand({
      TableName: tableName,
      IndexName: "ByAgentByStatus",
      KeyConditionExpression: "gsi1pk = :pk AND sk > :sk",
      ExpressionAttributeValues: {
        ":pk": { S: `CAT#${category}` },     
        ":sk": { S: `ITEM#${dateThreshold}` } 
      }
    });

    const response = await ddb.send(command);
    const items = response.Items || [];
    console.log(`Found ${items.length} items in last 30 days for ${category}`);

    // --- CIRCUIT BREAKER: If 0 items, don't waste money on AI ---
    if (items.length === 0) {
        return {
            predictedQuantity: 5, // Safe default starter prep
            confidence: "LOW",
            reasoning: "No sales history found in the last 30 days. Using default starter par.",
            seasonalNote: "New Item / Low Data",
            suggestedAction: "Prep 5 units as a trial"
        };
    }
    
    // 2. DATA AGGREGATION
    salesStats = items.reduce<SalesAccumulator>((acc, item) => {
      const sk = item.sk?.S;
      const qty = parseInt(item.quantity?.N || "1");
      if (!sk) return acc;
      
      const timestampPart = sk.split("#")[1]; 
      if (!timestampPart) return acc;

      const dateKey = timestampPart.split("T")[0]; 
      if (!acc[dateKey]) acc[dateKey] = 0;
      acc[dateKey] += qty;
      return acc;
    }, {});

    totalSold = Object.values(salesStats).reduce((a: number, b: number) => a + b, 0);
    avgDaily = Math.ceil(totalSold / 30) || 5; 

  } catch (dbError) {
    console.error("DB Error:", dbError);
    avgDaily = 5; 
  }

  // ====================================================
  // 3. AI PREDICTION (AMAZON TITAN)
  // ====================================================
  try {
    const prompt = `User: You are a Kitchen Manager. Predict prep quantities based on 30-day sales history.
    
Example Input:
Category: Burgers
Target Date: 2025-12-12
History: {"2025-12-08": 50, "2025-12-09": 55}
Total Sold (30 days): 450

Example Output:
{
  "predictedQuantity": 60,
  "confidence": "HIGH",
  "reasoning": "Upward trend detected.",
  "seasonalNote": "Regular weekday.",
  "suggestedAction": "Prep slightly more."
}

Current Input:
Category: ${category}
Target Date: ${targetDate}
History: ${JSON.stringify(salesStats)}
Total Sold (30 days): ${totalSold}

Task: Output valid JSON only.
\nBot:`;

    const titanPayload = {
      inputText: prompt,
      textGenerationConfig: {
        maxTokenCount: 300,
        temperature: 0.1, 
        topP: 0.9,
        stopSequences: ["User:"]
      }
    };

    const bedrockCommand = new InvokeModelCommand({
      modelId: "amazon.titan-text-express-v1",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(titanPayload)
    });

    const aiResponse = await bedrock.send(bedrockCommand);
    const responseBody = JSON.parse(new TextDecoder().decode(aiResponse.body));
    const aiText = responseBody.results[0].outputText;

    console.log("RAW AI:", aiText);

    // 4. PARSING LOGIC
    const jsonStart = aiText.indexOf('{');
    const jsonEnd = aiText.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = aiText.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(jsonStr);
    } 
    
    throw new Error("No JSON brackets found");

  } catch (error) {
    console.error("AI Error (Using Fallback):", error);
    
    return {
      predictedQuantity: Math.ceil(avgDaily * 1.1), 
      confidence: "LOW",
      reasoning: "AI analysis unavailable. Using 30-day average.",
      seasonalNote: "Standard Prep",
      suggestedAction: `Prep ${Math.ceil(avgDaily * 1.1)} units`
    };
  }
};