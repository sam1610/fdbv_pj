import { 
  CognitoIdentityProviderClient, 
  AdminCreateUserCommand, 
  AdminAddUserToGroupCommand 
} from "@aws-sdk/client-cognito-identity-provider";
// ✅ Import DynamoDB Clients
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const cognitoClient = new CognitoIdentityProviderClient();
const ddbClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (event: any) => {
  console.log("EVENT RECEIVED:", JSON.stringify(event));

  // ✅ Extract 'businessPhone'
  const { name, phone, email, businessPhone } = event.arguments;
  
  const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;
  const tableName = process.env.AMPLIFY_DATA_TABLE_NAME;

  if (!userPoolId || !tableName) {
    throw new Error("Missing Env Vars: UserPoolId or TableName");
  }

  // Sanitize phone
  const cleanPhone = phone.replace('+', '');
  const finalEmail = email || `${cleanPhone}@placeholder.com`;
  const username = finalEmail; 
  // Ensure we have a valid Agent SK format
  const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  try {
    // --- Step 1: Create Cognito User ---
    console.log(`Creating Cognito Identity: ${username}`);
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: username, 
      UserAttributes: [
        { Name: "phone_number", Value: formattedPhone },
        { Name: "name", Value: name },
        { Name: "email", Value: finalEmail },
        { Name: "email_verified", Value: "true" },
        { Name: "phone_number_verified", Value: "true" }
      ],
      TemporaryPassword: "Pa$$w0rd!", 
      MessageAction: "SUPPRESS"
    });

    try {
        await cognitoClient.send(createUserCommand);
    } catch (err: any) {
        if (err.name === 'UsernameExistsException') {
            console.log("⚠️ User exists, skipping creation.");
        } else {
            throw err; 
        }
    }

    // --- Step 2: Add to Group ---
    await cognitoClient.send(new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: "DeliveryAgents"
    }));

    // --- Step 3: Write to DynamoDB (THIS WAS MISSING) ---
    console.log(`Writing to Table: ${tableName}`);
    
    if (!businessPhone) {
      throw new Error("Business Phone is required to link Agent to Business");
    }

    const now = new Date().toISOString();
    const agentSk = `AGENT#${formattedPhone}`; 

    await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
            pk: `BUSINESS#${businessPhone}`,  // Links to the Business
            sk: agentSk,                     // Unique Agent ID
            __typename: 'BusinessData',      // Required for AppSync
            entityType: 'Agent',
            
            // Attributes
            name: name,
            phone: formattedPhone,
            email: finalEmail,
            
            // GSI Keys (For your 'ByAgentByStatus' index)
            gsi1pk: agentSk, 

            // Metadata
            createdAt: now,
            updatedAt: now,
            itemsNbr: 0,
            status: 'ACTIVE'
        }
    }));

    return { success: true, message: `Agent ${name} created successfully.` };

  } catch (error: any) {
    console.error("❌ FATAL ERROR:", error);
    throw new Error(error.message || "Failed to create Agent");
  }
};