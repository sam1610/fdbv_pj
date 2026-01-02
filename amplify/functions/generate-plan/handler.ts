// amplify/functions/generate-plan/handler.ts 
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});

export const handler = async (event: any) => {
  const { targetDate, category, businessPhone } = event.arguments;
  const tableName = process.env.AMPLIFY_DATA_TABLE_NAME;
  
  // 📅 Determine if target is a weekend (Friday=5, Saturday=6)
  const targetDay = new Date(targetDate).getDay();
  const isWeekend = targetDay === 5 || targetDay === 6;

  try {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30); // 30-day window

    const { Items = [] } = await ddb.send(new QueryCommand({
      TableName: tableName,
      IndexName: "ByAgentByStatus",
      KeyConditionExpression: "gsi1pk = :pk AND sk > :sk",
      ExpressionAttributeValues: {
        ":pk": { S: `CAT#${category}` },
        ":sk": { S: `ITEM#${pastDate.toISOString()}` }
      }
    }));

    // --- Circuit Breaker for No Data ---
    if (Items.length === 0) {
      return {
        predictedQuantity: 5,
        confidence: "LOW",
        reasoning: "No recent history for this category. Using safety starter par.",
        suggestedAction: "Prep 5 units as a baseline trial."
      };
    }

    // --- 1. Identify High-Demand Item ---
    const itemStats: Record<string, { total: number; name: string }> = {};
    Items.forEach(item => {
      const id = item.itemID?.S || "Unknown";
      const name = item.name?.S || id;
      const qty = parseInt(item.quantity?.N || "1");
      
      if (!itemStats[id]) itemStats[id] = { total: 0, name: name };
      itemStats[id].total += qty;
    });

    // Sort to find the item with the highest demand
    const sortedItems = Object.entries(itemStats).sort((a, b) => b[1].total - a[1].total);
    const [topId, stats] = sortedItems[0];

    // --- 2. Heuristic Forecast Logic ---
    const dailyAvg = stats.total / 30;
    // Apply a 70% boost for weekends or a 10% safety buffer for weekdays
    const multiplier = isWeekend ? 1.7 : 1.1; 
    const finalPrediction = Math.ceil(dailyAvg * multiplier);

    return {
      predictedQuantity: finalPrediction,
      confidence: Items.length > 30 ? "HIGH" : "MEDIUM",
      reasoning: `Based on 30-day demand for ${stats.name}. Current average is ${dailyAvg.toFixed(1)} units/day.`,
      seasonalNote: isWeekend ? "Weekend high-demand multiplier applied." : "Standard weekday trend.",
      suggestedAction: `Focus prep on ${finalPrediction} units of ${stats.name}.`
    };

  } catch (error) {
    console.error("Forecast Error:", error);
    return { predictedQuantity: 5, confidence: "ERROR", reasoning: "System fallback applied." };
  }
};