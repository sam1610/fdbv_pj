import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { optimizeDelivery } from './functions/optimizeDelivery/resource';
import { PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { CfnMap } from 'aws-cdk-lib/aws-location'; //

const backend = defineBackend({
  auth,
  data,
  optimizeDelivery,
});

// 1. Create the Map Resource (CDK Escape Hatch)
const geoStack = backend.createStack('GeoStack');

const myMap = new CfnMap(geoStack, 'DeliveryMap', {
  mapName: 'deliveryMap',
  configuration: {
    style: 'VectorEsriNavigation', // Or 'VectorEsriStreets'
  },
  pricingPlan: 'RequestBasedUsage',
});

// 2. Grant Permissions to Frontend (Auth Roles)
const geoPolicy = new PolicyStatement({
  actions: [
    'geo:GetMapTile',
    'geo:GetMapSprites',
    'geo:GetMapGlyphs',
    'geo:GetMapStyleDescriptor',
  ],
  resources: [myMap.attrArn],
});

backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);
backend.auth.resources.unauthenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);


Object.values(backend.auth.resources.groups).forEach((groupResource) => {
  // The 'groupResource' is an object { cfnUserGroup, role }, so we access .role
  groupResource.role.addToPrincipalPolicy(geoPolicy);
});
// 3. Export Config (Critical for the frontend to find the map)
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

// 4. Grant Lambda Permissions (for Route Calculation)
backend.optimizeDelivery.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['geo-routes:CalculateRouteMatrix'],
  resources: ['*'],
}));