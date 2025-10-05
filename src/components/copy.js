import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

// --- CONFIGURATION ---
const AWS_REGION = 'us-east-1'; // e.g., 'us-east-1'
const SOURCE_TABLE_NAME = 'BusinessData-4a564373pfc3faeg6ouiafo4hq-NONE' //re copying FROM
const DESTINATION_TABLE_NAME = 'BusinessData-h2nqtixy75bhxi3k5f435v4tte-NONE'; // The table you're copying TO
// ---------------------

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function copyTable() {
  console.log(`Starting copy from ${SOURCE_TABLE_NAME} to ${DESTINATION_TABLE_NAME}...`);
  let lastEvaluatedKey = undefined;
  let itemsCopied = 0;

  try {
    do {
      // 1. Scan the source table, handling pagination
      const scanParams = {
        TableName: SOURCE_TABLE_NAME,
        ExclusiveStartKey: lastEvaluatedKey,
      };

      console.log('Scanning for items...');
      const scanResult = await docClient.send(new ScanCommand(scanParams));
      const items = scanResult.Items;

      if (items && items.length > 0) {
        // 2. Prepare the items for a BatchWriteCommand (max 25 items per batch)
        const putRequests = items.map(item => ({
          PutRequest: {
            Item: item,
          },
        }));

        const batchWriteParams = {
          RequestItems: {
            [DESTINATION_TABLE_NAME]: putRequests,
          },
        };

        // 3. Execute the batch write to the destination table
        console.log(`Writing a batch of ${items.length} items...`);
        await docClient.send(new BatchWriteCommand(batchWriteParams));
        itemsCopied += items.length;
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`✅ Success! Copied a total of ${itemsCopied} items.`);

  } catch (error) {
    console.error('❌ An error occurred during the copy process:', error);
  }
}

copyTable();
