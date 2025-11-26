import { 
  CognitoIdentityProviderClient, 
  AdminCreateUserCommand, 
  AdminAddUserToGroupCommand 
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient();

export const handler = async (event: any) => {
  console.log("EVENT RECEIVED:", JSON.stringify(event));

  const { name, phone, email } = event.arguments;
  const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;

  if (!userPoolId) {
    throw new Error("Missing User Pool ID environment variable");
  }

  // FIX: Cognito expects an email format for username if configured that way.
  // If the user didn't provide an email, generate a placeholder based on phone.
  // e.g. "+97333333333@no-email.com"
  // Remove '+' to make it cleaner for the local part of email
  const cleanPhone = phone.replace('+', '');
  const finalEmail = email || `${cleanPhone}@placeholder.com`;
  
  // We will use the EMAIL as the username to satisfy the "Username should be an email" constraint.
  const username = finalEmail; 

  try {
    // --- Step 1: Create User ---
    console.log(`Creating user with username: ${username}`);
    
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: username, 
      UserAttributes: [
        { Name: "phone_number", Value: phone }, // Store real phone here
        { Name: "name", Value: name },
        { Name: "email", Value: finalEmail },
        { Name: "email_verified", Value: "true" },
        { Name: "phone_number_verified", Value: "true" }
      ],
      TemporaryPassword: "Welcome123!", 
      MessageAction: "SUPPRESS"
    });

    try {
        await client.send(createUserCommand);
        console.log("✅ User created successfully");
    } catch (err: any) {
        if (err.name === 'UsernameExistsException') {
            console.log("⚠️ User already exists, proceeding to add to group...");
        } else {
            console.error("❌ User creation failed:", err);
            throw err; 
        }
    }

    // --- Step 2: Add to Group ---
    const groupName = "DeliveryAgents"; 
    console.log(`Adding user ${username} to group: ${groupName}`);
    
    const addToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: groupName
    });

    try {
      await client.send(addToGroupCommand);
      console.log("✅ User added to group successfully");
    } catch (err: any) {
      console.error("❌ Failed to add user to group:", err);
      throw err;
    }

    return { success: true, message: `Agent ${name} created. Login: ${username}` };

  } catch (error: any) {
    console.error("❌ FATAL ERROR:", error);
    throw new Error(error.message || "Failed to create Cognito user");
  }
};