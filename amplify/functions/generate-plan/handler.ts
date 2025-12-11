import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// Initialize Clients
const ddb = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });

// 1. Define the Expected Input Type (Fixes 'event has implicit any')
interface HandlerEvent {
  arguments: {
    businessPhone: string; // Added this just in case, though we rely on env vars mostly
    targetDate: string;
    category: string;
  };
}

// 2. Define the Accumulator Type for the Reducer (Fixes 'operator += cannot be applied')
interface SalesAccumulator {
  [date: string]: number;
}

export const handler = async (event: HandlerEvent) => {
  console.log("EVENT RECEIVED:", JSON.stringify(event));
  
  const { targetDate, category } = event.arguments;
  const tableName = process.env.AMPLIFY_DATA_TABLE_NAME;

  if (!tableName) throw new Error("Missing Table Name environment variable");

  try {
    // ====================================================
    // 1. DATA FETCHING
    // ====================================================
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateThreshold = sevenDaysAgo.toISOString();

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
    console.log(`Fetched ${items.length} items for category ${category}`);

    // ====================================================
    // 2. DATA AGGREGATION (Type Safe Version)
    // ====================================================

    // We explicitly tell reduce that 'acc' is a SalesAccumulator object
    const salesStats = items.reduce<SalesAccumulator>((acc, item) => {
      
      // Fix: Safely access Nested Properties (Fixes 'possibly undefined')
      const sk = item.sk?.S;
      const qtyStr = item.quantity?.N;

      if (!sk) return acc; // Skip corrupt records

      // SK format: ITEM#2025-12-10T12:00...#001
      const timestampPart = sk.split("#")[1]; 
      if (!timestampPart) return acc;

      const dateKey = timestampPart.split("T")[0]; // "2025-12-10"
      const qty = parseInt(qtyStr || "1");

      if (!acc[dateKey]) {
        acc[dateKey] = 0;
      }
      
      acc[dateKey] += qty;
      return acc;
    }, {});

    // Fix: Explicit typing for the reducer sum
    const totalSold = Object.values(salesStats).reduce((a: number, b: number) => a + b, 0);
    console.log("Aggregated Stats:", salesStats);

    // ====================================================
    // 3. AI PREDICTION
    // ====================================================

    const prompt = `
      You are an expert Kitchen Manager AI.
      
      CONTEXT:
      - Target Date: ${targetDate}
      - Category: "${category}"
      - Sales History (Last 7 Days): ${JSON.stringify(salesStats)}
      - Total Units Sold: ${totalSold}

      TASK:
      Predict the prep quantity for "${targetDate}".

      RULES:
      1. **Seasonality:** Check if Target Date is a weekend. If history shows weekend spikes, increase prediction.
      2. **Trend Analysis:** If sales are trending up day-over-day, predict higher than the average.
      3. **Category logic:** "SANDWICHES_WRAPS" are high turnover. Do not under-prep.

      OUTPUT:
      Return strictly VALID JSON only.
      {
        "predictedQuantity": (integer),
        "confidence": "HIGH" | "MEDIUM" | "LOW",
        "reasoning": "(Explain the trend logic used)",
        "seasonalNote": "(Mention day of week impact)",
        "suggestedAction": "(e.g. 'Prep 20 units')"
      }
    `;

    const bedrockCommand = new InvokeModelCommand({
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 500,
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    const aiResponse = await bedrock.send(bedrockCommand);
    const responseBody = JSON.parse(new TextDecoder().decode(aiResponse.body));
    const result = JSON.parse(responseBody.content[0].text);

    return result;

  } catch (error) {
    console.error("Handler Error:", error);
    
    // Fix: Cast error to Error type (Fixes 'error is of type unknown')
    const errorMessage = error instanceof Error ? error.message : "Unknown System Error";

    return {
      predictedQuantity: 0,
      confidence: "LOW",
      reasoning: "System Error: " + errorMessage,
      seasonalNote: "N/A",
      suggestedAction: "Contact Admin"
    };
  }
};