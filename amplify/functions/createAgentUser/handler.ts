// import { 
//   CognitoIdentityProviderClient, 
//   AdminCreateUserCommand, 
//   AdminAddUserToGroupCommand 
// } from "@aws-sdk/client-cognito-identity-provider";
// // ✅ Import DynamoDB Clients
// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

// const cognitoClient = new CognitoIdentityProviderClient();
// const ddbClient = new DynamoDBClient();
// const docClient = DynamoDBDocumentClient.from(ddbClient);

// export const handler = async (event: any) => {
//   console.log("EVENT RECEIVED:", JSON.stringify(event));

//   // ✅ Extract 'businessPhone'
//   const { name, phone, email, businessPhone } = event.arguments;
  
//   const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;
//   const tableName = process.env.AMPLIFY_DATA_TABLE_NAME;

//   if (!userPoolId || !tableName) {
//     throw new Error("Missing Env Vars: UserPoolId or TableName");
//   }

//   // Sanitize phone
//   const cleanPhone = phone.replace('+', '');
//   const finalEmail = email || `${cleanPhone}@placeholder.com`;
//   const username = finalEmail; 
//   // Ensure we have a valid Agent SK format
//   const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

//   try {
//     // --- Step 1: Create Cognito User ---
//     console.log(`Creating Cognito Identity: ${username}`);
//     const createUserCommand = new AdminCreateUserCommand({
//       UserPoolId: userPoolId,
//       Username: username, 
//       UserAttributes: [
//         { Name: "phone_number", Value: formattedPhone },
//         { Name: "name", Value: name },
//         { Name: "email", Value: finalEmail },
//         { Name: "email_verified", Value: "true" },
//         { Name: "phone_number_verified", Value: "true" }
//       ],
//       TemporaryPassword: "Pa$$w0rd!", 
//       MessageAction: "SUPPRESS"
//     });

//     try {
//         await cognitoClient.send(createUserCommand);
//     } catch (err: any) {
//         if (err.name === 'UsernameExistsException') {
//             console.log("⚠️ User exists, skipping creation.");
//         } else {
//             throw err; 
//         }
//     }

//     // --- Step 2: Add to Group ---
//     await cognitoClient.send(new AdminAddUserToGroupCommand({
//       UserPoolId: userPoolId,
//       Username: username,
//       GroupName: "DeliveryAgents"
//     }));

//     // --- Step 3: Write to DynamoDB (THIS WAS MISSING) ---
//     console.log(`Writing to Table: ${tableName}`);
    
//     if (!businessPhone) {
//       throw new Error("Business Phone is required to link Agent to Business");
//     }

//     const now = new Date().toISOString();
//     const agentSk = `AGENT#${formattedPhone}`; 

//     await docClient.send(new PutCommand({
//         TableName: tableName,
//         Item: {
//             pk: `BUSINESS#${businessPhone}`,  // Links to the Business
//             sk: agentSk,                     // Unique Agent ID
//             __typename: 'BusinessData',      // Required for AppSync
//             entityType: 'Agent',
            
//             // Attributes
//             name: name,
//             phone: formattedPhone,
//             email: finalEmail,
            
//             // GSI Keys (For your 'ByAgentByStatus' index)
//             gsi1pk: agentSk, 

//             // Metadata
//             createdAt: now,
//             updatedAt: now,
//             itemsNbr: 0,
//             status: 'ACTIVE'
//         }
//     }));

//     return { success: true, message: `Agent ${name} created successfully.` };

//   } catch (error: any) {
//     console.error("❌ FATAL ERROR:", error);
//     throw new Error(error.message || "Failed to create Agent");
//   }
// };

import { 
  CognitoIdentityProviderClient, 
  AdminCreateUserCommand, 
  AdminAddUserToGroupCommand 
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// ✅ UPDATED IMPORTS: Added GetCommand and TransactWriteCommand
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  TransactWriteCommand 
} from "@aws-sdk/lib-dynamodb";

const cognitoClient = new CognitoIdentityProviderClient();
const ddbClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (event: any) => {
  console.log("EVENT RECEIVED:", JSON.stringify(event));

  // ✅ Extract 'maxCapacityUnit' along with other fields
  const { name, phone, email, businessPhone, maxCapacityUnit } = event.arguments;
  
  const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;
  const tableName = process.env.AMPLIFY_DATA_TABLE_NAME;

  if (!userPoolId || !tableName) {
    throw new Error("Missing Env Vars: UserPoolId or TableName");
  }

  // Sanitize phone & email
  let rawPhone = phone.replace(/\s+/g, '');
  rawPhone = rawPhone.replace('+', '');
  const formattedPhone = `+${rawPhone}`;
  const finalEmail = email ? email.trim() : `${rawPhone}@placeholder.com`;
  const username = finalEmail; 

  // Default Capacity if not provided (Default: 10)
  const maxCap = maxCapacityUnit ? parseInt(maxCapacityUnit) : 10;

  try {
    // ====================================================
    // 🚨 STEP 0: SAFETY CHECK (PREVENT DUPLICATES)
    // ====================================================
    // Check if this Agent is ALREADY linked to this Business
    const agentPk = `AGENT#${formattedPhone}`;
    const businessPk = `BUSINESS#${businessPhone}`;

    const existingLink = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: {
            pk: businessPk,
            sk: agentPk
        }
    }));

    if (existingLink.Item) {
        throw new Error(`Agent ${name} is already added to this business.`);
    }

    // ====================================================
    // ✅ STEP 1: CREATE COGNITO USER (UNCHANGED)
    // ====================================================
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

    // ====================================================
    // ✅ STEP 2: ADD TO GROUP (UNCHANGED)
    // ====================================================
    await cognitoClient.send(new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: "DeliveryAgents"
    }));

    // ====================================================
    // ⚡ STEP 3: TRANSACTIONAL WRITE (UPDATED)
    // ====================================================
    // We now write TWO records at once:
    // 1. The Business Link (so you see them in your dashboard)
    // 2. The Agent Profile (so they have a unique record for location/capacity)
    
    console.log(`Writing Records to Table: ${tableName}`);
    const now = new Date().toISOString();

    await docClient.send(new TransactWriteCommand({
        TransactItems: [
            {
                // RECORD 1: Link Agent to Business (Your Original Logic)
                Put: {
                    TableName: tableName,
                    Item: {
                        pk: businessPk,
                        sk: agentPk,
                        __typename: 'BusinessData',
                        entityType: 'AgentLink', // Changed to 'AgentLink' to distinguish
                        name: name,
                        phone: formattedPhone,
                        email: finalEmail,
                        gsi1pk: agentPk, 
                        createdAt: now,
                        updatedAt: now,
                        itemsNbr: 0, // Load for this business specific view
                        status: 'ACTIVE'
                    }
                }
            },
            {
                // RECORD 2: The Agent Profile (Shared Record)
                // We use 'Update' to be safe: If they exist, we just update details.
                // We protect 'itemsNbr' (Current Load) so we don't reset active drivers.
                Update: {
                    TableName: tableName,
                    Key: {
                        pk: agentPk,
                        sk: agentPk
                    },
                    UpdateExpression: "SET #name = :name, #email = :email, #status = :status, #type = :type, #typename = :typename, #updatedAt = :updatedAt, #maxCap = :maxCap, #gsi1pk = :gsi1pk, #itemsNbr = if_not_exists(#itemsNbr, :zero)",
                    ExpressionAttributeNames: {
                        "#name": "name",
                        "#email": "email",
                        "#status": "status",
                        "#type": "entityType",
                        "#typename": "__typename",
                        "#updatedAt": "updatedAt",
                        "#maxCap": "maxCapacityUnit", // ✅ NEW: Saving Max Capacity
                        "#gsi1pk": "gsi1pk",
                        "#itemsNbr": "itemsNbr"       // ✅ NEW: Tracks Global Current Load
                    },
                    ExpressionAttributeValues: {
                        ":name": name,
                        ":email": finalEmail,
                        ":status": "ACTIVE",
                        ":type": "Agent",
                        ":typename": "BusinessData",
                        ":updatedAt": now,
                        ":maxCap": maxCap,           // Save the capacity from the form
                        ":gsi1pk": agentPk,
                        ":zero": 0                   // Initialize load to 0 ONLY if new
                    }
                }
            }
        ]
    }));

    return { success: true, message: `Agent ${name} created successfully.` };

  } catch (error: any) {
    console.error("❌ FATAL ERROR:", error);
    throw new Error(error.message || "Failed to create Agent");
  }
};