import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { optimizeDelivery } from './functions/optimizeDelivery/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnMap } from 'aws-cdk-lib/aws-location';

const backend = defineBackend({
  auth,
  data,
  optimizeDelivery,
});

// --- 1. Create Unique Map Name (THE FIX) ---
// We grab the branch name (e.g., 'main', 'dev') or default to 'sandbox'.
// This ensures the Sandbox map ('deliveryMap-sandbox') doesn't clash with your Branch map.
const branchName = (process.env.AWS_BRANCH || 'sandbox').replace(/[^a-zA-Z0-9-]/g, '-');
const uniqueMapName = `deliveryMap-${branchName}`;

// --- 2. Create the Map Resource ---
const geoStack = backend.createStack('GeoStack');

const myMap = new CfnMap(geoStack, 'DeliveryMap', {
  mapName: uniqueMapName, // ✅ Uses the dynamic unique name
  configuration: {
    style: 'VectorEsriNavigation',
  },
  pricingPlan: 'RequestBasedUsage',
});

// --- 3. Define the Map Access Policy ---
const geoPolicy = new PolicyStatement({
  actions: [
    'geo:GetMapTile',
    'geo:GetMapSprites',
    'geo:GetMapGlyphs',
    'geo:GetMapStyleDescriptor',
  ],
  resources: [myMap.attrArn],
});

// --- 4. Grant Map Permissions ---

// A. Default Roles (Authenticated Users & Guests)
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);
backend.auth.resources.unauthenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);

// B. Group Roles (Admins, DeliveryAgents)
// This ensures your Admin user (and future Agents) can see the map
Object.values(backend.auth.resources.groups).forEach((groupResource) => {
  groupResource.role.addToPrincipalPolicy(geoPolicy);
});

// --- 5. Export Configuration for Frontend ---
backend.addOutput({
  geo: {
    aws_region: geoStack.region,
    maps: {
      items: {
        [uniqueMapName]: { // ✅ Key matches unique name
          style: 'VectorEsriNavigation',
        },
      },
      default: uniqueMapName, // ✅ Default matches unique name
    },
  },
});

// --- 6. Grant Lambda Permissions (for Route Optimization) ---
backend.optimizeDelivery.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['geo-routes:CalculateRouteMatrix'],
  resources: ['*'],
}));