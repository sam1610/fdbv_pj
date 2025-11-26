// import { defineBackend } from '@aws-amplify/backend';
// import { auth } from './auth/resource';
// import { data } from './data/resource';
// import { optimizeDelivery } from './functions/optimizeDelivery/resource';
// import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
// import { CfnMap } from 'aws-cdk-lib/aws-location';
// import { createAgentUser } from './functions/createAgentUser/resource'; // 2. Import the create function


// const backend = defineBackend({
//   auth,
//   data,
//   optimizeDelivery,
//   createAgentUser, // 2. Add to backend definition
// });
// backend.createAgentUser.addEnvironment(
//   "AMPLIFY_AUTH_USERPOOL_ID",
//   backend.auth.resources.userPool.userPoolId
// );
// // --- 1. Create Unique Map Name (THE FIX) ---
// // We grab the branch name (e.g., 'main', 'dev') or default to 'sandbox'.
// // This ensures the Sandbox map ('deliveryMap-sandbox') doesn't clash with your Branch map.
// const branchName = (process.env.AWS_BRANCH || 'sandbox').replace(/[^a-zA-Z0-9-]/g, '-');
// const uniqueMapName = `deliveryMap-${branchName}`;

// // --- 2. Create the Map Resource ---
// const geoStack = backend.createStack('GeoStack');

// const myMap = new CfnMap(geoStack, 'DeliveryMap', {
//   mapName: uniqueMapName, // ✅ Uses the dynamic unique name
//   configuration: {
//     style: 'VectorEsriNavigation',
//   },
//   pricingPlan: 'RequestBasedUsage',
// });


// // --- 3. Define the Map Access Policy ---
// const geoPolicy = new PolicyStatement({
//   actions: [
//     'geo:GetMapTile',
//     'geo:GetMapSprites',
//     'geo:GetMapGlyphs',
//     'geo:GetMapStyleDescriptor',
//   ],
//   resources: [myMap.attrArn],
// });

// // --- 4. Grant Map Permissions ---

// // A. Default Roles (Authenticated Users & Guests)
// backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);
// backend.auth.resources.unauthenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);

// // B. Group Roles (Admins, DeliveryAgents)
// // This ensures your Admin user (and future Agents) can see the map
// Object.values(backend.auth.resources.groups).forEach((groupResource) => {
//   groupResource.role.addToPrincipalPolicy(geoPolicy);
// });

// // --- 5. Export Configuration for Frontend ---
// backend.addOutput({
//   geo: {
//     aws_region: geoStack.region,
//     maps: {
//       items: {
//         [uniqueMapName]: { // ✅ Key matches unique name
//           style: 'VectorEsriNavigation',
//         },
//       },
//       default: uniqueMapName, // ✅ Default matches unique name
//     },
//   },
// });

// // --- 6. Grant Lambda Permissions (for Route Optimization) ---
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
import { createAgentUser } from './functions/createAgentUser/resource'; // 2. Import the create function

const backend = defineBackend({
  auth,
  data,
  optimizeDelivery,
  createAgentUser, // 2. Add to backend definition
});

// --- 1. Configure Create Agent Function (Env Vars & Permissions) ---
backend.createAgentUser.addEnvironment(
  "AMPLIFY_AUTH_USERPOOL_ID",
  backend.auth.resources.userPool.userPoolId
);

const cognitoPolicy = new PolicyStatement({
  actions: [
    "cognito-idp:AdminCreateUser",
    "cognito-idp:AdminAddUserToGroup"
  ],
  resources: [backend.auth.resources.userPool.userPoolArn],
});

backend.createAgentUser.resources.lambda.addToRolePolicy(cognitoPolicy);


// --- 2. Create Unique Map Name ---
const branchName = (process.env.AWS_BRANCH || 'sandbox').replace(/[^a-zA-Z0-9-]/g, '-');
const uniqueMapName = `deliveryMap-${branchName}`;

// --- 3. Create the Map Resource ---
const geoStack = backend.createStack('GeoStack');

const myMap = new CfnMap(geoStack, 'DeliveryMap', {
  mapName: uniqueMapName,
  configuration: {
    style: 'VectorEsriNavigation',
  },
  pricingPlan: 'RequestBasedUsage',
});

// --- 4. Define the Map Access Policy ---
const geoPolicy = new PolicyStatement({
  actions: [
    'geo:GetMapTile',
    'geo:GetMapSprites',
    'geo:GetMapGlyphs',
    'geo:GetMapStyleDescriptor',
  ],
  resources: [myMap.attrArn],
});

// --- 5. Grant Map Permissions ---
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);
backend.auth.resources.unauthenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);

Object.values(backend.auth.resources.groups).forEach((groupResource) => {
  groupResource.role.addToPrincipalPolicy(geoPolicy);
});

// --- 6. Export Configuration for Frontend ---
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

// --- 7. Grant Route Optimization Permissions ---
backend.optimizeDelivery.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['geo-routes:CalculateRouteMatrix'],
  resources: ['*'],
}));
