import { defineBackend } from '@aws-amplify/backend';
import { auth } from '../auth/resource';
import { data } from '../data/resource';
import { optimizeDelivery } from '../functions/optimizeDelivery/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnMap } from 'aws-cdk-lib/aws-location'; // Import standard CDK Map resource

const backend = defineBackend({
  auth,
  data,
  optimizeDelivery,
});

// --- 1. Create the Map Resource using CDK ---
// We create a separate stack for Geo resources to keep things tidy
const geoStack = backend.createStack('GeoStack');

const myMap = new CfnMap(geoStack, 'DeliveryMap', {
  mapName: 'deliveryMap',
  configuration: {
    style: 'VectorEsriNavigation', // Use 'VectorEsriNavigation', 'VectorEsriStreets', etc.
  },
  pricingPlan: 'RequestBasedUsage',
});

// --- 2. Grant Permissions to your Frontend (Auth Roles) ---
// This allows your logged-in (and public, if desired) users to see the map tiles
const geoPolicy = new PolicyStatement({
  actions: ['geo:GetMapTile', 'geo:GetMapSprites', 'geo:GetMapGlyphs', 'geo:GetMapStyleDescriptor'],
  resources: [myMap.attrArn],
});

backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);
backend.auth.resources.unauthenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);

// --- 3. Grant Permissions to your Optimization Lambda (if it needs to read map data) ---
// (Optional: Only strictly needed if your Lambda does reverse geocoding or map lookups, but good to have)
backend.optimizeDelivery.resources.lambda.addToRolePolicy(geoPolicy);

// --- 4. Export the Config so React can see it ---
// This writes to amplify_outputs.json automatically
backend.addOutput({
  geo: {
    aws_region: geoStack.region,
    maps: {
      items: {
        [myMap.mapName]: {
          style: 'VectorEsriNavigation',
        },
      },
      default: myMap.mapName,
    },
  },
});

// --- 5. Add your existing Route Matrix Policy for the Lambda ---
const geoRoutesPolicy = new PolicyStatement({
  actions: ['geo-routes:CalculateRouteMatrix'],
  resources: ['*'],
});
backend.optimizeDelivery.resources.lambda.addToRolePolicy(geoRoutesPolicy);