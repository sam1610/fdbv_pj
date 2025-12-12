

// import { defineBackend } from '@aws-amplify/backend';
// import { auth } from './auth/resource';
// import { data } from './data/resource';
// import { optimizeDelivery } from './functions/optimizeDelivery/resource';
// import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
// import { CfnMap } from 'aws-cdk-lib/aws-location';
// import { createAgentUser } from './functions/createAgentUser/resource'; // 2. Import the create function
// import { generatePlanHandler } from './functions/generate-plan/resource';

// const backend = defineBackend({
//   auth,
//   data,
//   optimizeDelivery,
//   createAgentUser, 
//   generatePlanHandler,
// });



// // --- 1. Configure Create Agent Function (Env Vars & Permissions) ---
// backend.createAgentUser.addEnvironment(
//   "AMPLIFY_AUTH_USERPOOL_ID",
//   backend.auth.resources.userPool.userPoolId
// );
// backend.createAgentUser.addEnvironment(
//   'AMPLIFY_DATA_TABLE_NAME', 
//   backend.data.resources.tables['BusinessData'].tableName
// );
// const cognitoPolicy = new PolicyStatement({
//   actions: [
//     "cognito-idp:AdminCreateUser",
//     "cognito-idp:AdminAddUserToGroup"
//   ],
//   resources: [backend.auth.resources.userPool.userPoolArn],
// });

// backend.createAgentUser.resources.lambda.addToRolePolicy(cognitoPolicy);

// backend.data.resources.tables['BusinessData'].grantWriteData(
//   backend.createAgentUser.resources.lambda
// );
// // --- 2. Create Unique Map Name ---
// const branchName = (process.env.AWS_BRANCH || 'sandbox').replace(/[^a-zA-Z0-9-]/g, '-');
// const uniqueMapName = `deliveryMap-${branchName}`;

// // --- 3. Create the Map Resource ---
// const geoStack = backend.createStack('GeoStack');

// const myMap = new CfnMap(geoStack, 'DeliveryMap', {
//   mapName: uniqueMapName,
//   configuration: {
//     style: 'VectorEsriNavigation',
//   },
//   pricingPlan: 'RequestBasedUsage',
// });

// // --- 4. Define the Map Access Policy ---
// const geoPolicy = new PolicyStatement({
//   actions: [
//     'geo:GetMapTile',
//     'geo:GetMapSprites',
//     'geo:GetMapGlyphs',
//     'geo:GetMapStyleDescriptor',
//   ],
//   resources: [myMap.attrArn],
// });

// // --- 5. Grant Map Permissions ---
// backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);
// backend.auth.resources.unauthenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);

// Object.values(backend.auth.resources.groups).forEach((groupResource) => {
//   groupResource.role.addToPrincipalPolicy(geoPolicy);
// });

// // --- 6. Export Configuration for Frontend ---
// backend.addOutput({
//   geo: {
//     aws_region: geoStack.region,
//     maps: {
//       items: {
//         [uniqueMapName]: { 
//           style: 'VectorEsriNavigation',
//         },
//       },
//       default: uniqueMapName,
//     },
//   },
// });

// // --- 7. Grant Route Optimization Permissions ---
// backend.optimizeDelivery.resources.lambda.addToRolePolicy(new PolicyStatement({
//   actions: ['geo-routes:CalculateRouteMatrix'],
//   resources: ['*'],
// }));




import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { optimizeDelivery } from './functions/optimizeDelivery/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnMap } from 'aws-cdk-lib/aws-location';
import { createAgentUser } from './functions/createAgentUser/resource'; 
import { generatePlanHandler } from './functions/generate-plan/resource';

const backend = defineBackend({
  auth,
  data,
  optimizeDelivery,
  createAgentUser, 
  generatePlanHandler,
});

// ====================================================
// A. KITCHEN PREP AI CONFIGURATION
// ====================================================

const businessTable = backend.data.resources.tables['BusinessData'];

// 1. Give the Lambda the Table Name so it can run QueryCommands
backend.generatePlanHandler.addEnvironment(
  'AMPLIFY_DATA_TABLE_NAME', 
  businessTable.tableName
);

// 2. Grant Read Access to DynamoDB Table (for base table operations)
businessTable.grantReadData(
  backend.generatePlanHandler.resources.lambda
);

// 2.5. [FIX] Grant Access to Query Indexes (GSIs)
// This specifically fixes the "ByAgentByStatus" permission error
backend.generatePlanHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Query'],
    resources: [
      businessTable.tableArn + '/index/*' // Allows querying ALL indexes on this table
    ],
  })
);

// 3. Grant Permission to invoke Bedrock (Claude 3.5 Sonnet)
backend.generatePlanHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      // Check your region! This ARN is for us-east-1
      'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-text-express-v1'
    ],
  })
);

// ====================================================
// B. AGENT USER CONFIGURATION
// ====================================================

// 1. Configure Create Agent Function (Env Vars & Permissions)
backend.createAgentUser.addEnvironment(
  "AMPLIFY_AUTH_USERPOOL_ID",
  backend.auth.resources.userPool.userPoolId
);
backend.createAgentUser.addEnvironment(
  'AMPLIFY_DATA_TABLE_NAME', 
  businessTable.tableName
);
const cognitoPolicy = new PolicyStatement({
  actions: [
    "cognito-idp:AdminCreateUser",
    "cognito-idp:AdminAddUserToGroup"
  ],
  resources: [backend.auth.resources.userPool.userPoolArn],
});

backend.createAgentUser.resources.lambda.addToRolePolicy(cognitoPolicy);

businessTable.grantWriteData(
  backend.createAgentUser.resources.lambda
);

// ====================================================
// C. GEOLOCATION & MAPS CONFIGURATION
// ====================================================

// 1. Create Unique Map Name
const branchName = (process.env.AWS_BRANCH || 'sandbox').replace(/[^a-zA-Z0-9-]/g, '-');
const uniqueMapName = `deliveryMap-${branchName}`;

// 2. Create the Map Resource
const geoStack = backend.createStack('GeoStack');

const myMap = new CfnMap(geoStack, 'DeliveryMap', {
  mapName: uniqueMapName,
  configuration: {
    style: 'VectorEsriNavigation',
  },
  pricingPlan: 'RequestBasedUsage',
});

// 3. Define the Map Access Policy
const geoPolicy = new PolicyStatement({
  actions: [
    'geo:GetMapTile',
    'geo:GetMapSprites',
    'geo:GetMapGlyphs',
    'geo:GetMapStyleDescriptor',
  ],
  resources: [myMap.attrArn],
});

// 4. Grant Map Permissions
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);
backend.auth.resources.unauthenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);

Object.values(backend.auth.resources.groups).forEach((groupResource) => {
  groupResource.role.addToPrincipalPolicy(geoPolicy);
});

// 5. Export Configuration for Frontend
backend.addOutput({
  geo: {
    aws_region: geoStack.region,
    maps: {
      items: {
        [uniqueMapName]: { 
          style: 'VectorEsriNavigation',
        },
      },
      default: uniqueMapName,
    },
  },
});

// 6. Grant Route Optimization Permissions
backend.optimizeDelivery.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['geo-routes:CalculateRouteMatrix'],
  resources: ['*'],
}));
