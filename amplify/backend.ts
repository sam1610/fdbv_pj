import { defineBackend , secret } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { optimizeDelivery } from './functions/optimizeDelivery/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnMap, CfnTracker } from 'aws-cdk-lib/aws-location';
import { createAgentUser } from './functions/createAgentUser/resource'; 
import { generatePlanHandler } from './functions/generate-plan/resource';
import { CfnTable } from 'aws-cdk-lib/aws-dynamodb';
import { registerBusinessPhone } from './functions/registerBusinessPhone/resource';
import { generateVipRecommendationsLambda } from './functions/generateVipRecommendations/resource';

// 🟢 1. IMPORT THE NEW VIP FUNCTION
import { sendVipOffer } from './functions/sendVipOffer/resource';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

const backend = defineBackend({
  auth,
  data,
  optimizeDelivery,
  createAgentUser, 
  generatePlanHandler,
  registerBusinessPhone,
  sendVipOffer,
  generateVipRecommendationsLambda
});

// backend.registerBusinessPhone.addEnvironment('WABA_ID', secret('WABA_ID'));
// backend.registerBusinessPhone.addEnvironment('META_SYSTEM_USER_TOKEN', secret('META_SYSTEM_USER_TOKEN'));
backend.registerBusinessPhone.addEnvironment(
  'APPSYNC_ENDPOINT_URL',
  backend.data.resources.cfnResources.cfnGraphqlApi.attrGraphQlUrl
);

if (backend.data.resources.cfnResources.cfnApiKey) {
  backend.registerBusinessPhone.addEnvironment(
    'APPSYNC_API_KEY',
    backend.data.resources.cfnResources.cfnApiKey.attrApiKey
  );
}

backend.registerBusinessPhone.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['appsync:GraphQL'],
    resources: [backend.data.resources.graphqlApi.arn + '/*'],
  })
);

const businessTable = backend.data.resources.tables['BusinessData'];
if (businessTable) {
  const cfnTable = businessTable.node.defaultChild as CfnTable;
  
  if (cfnTable) {
    cfnTable.timeToLiveSpecification = {
      attributeName: 'expiration',
      enabled: true
    };
  }
}

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
      'arn:aws:bedrock:us-east-1::foundation-model/*'
    ],
  })
);

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

businessTable.grantReadWriteData(backend.createAgentUser.resources.lambda);

// ====================================================
// C. GEOLOCATION & MAPS CONFIGURATION
// ====================================================

// 1. Create Unique Map Name
const branchName = (process.env.AWS_BRANCH || 'sandbox').replace(/[^a-zA-Z0-9-]/g, '-');
const uniqueMapName = `deliveryMap-${branchName}`;
const uniqueTrackerName = `deliveryTracker-${branchName}`;

// 2. Create the Map Resource
const geoStack = backend.createStack('GeoStack');

const myMap = new CfnMap(geoStack, 'DeliveryMap', {
  mapName: uniqueMapName,
  configuration: {
    style: 'VectorEsriNavigation',
  },
  pricingPlan: 'RequestBasedUsage',
});

const myTracker = new CfnTracker(geoStack, 'DeliveryTracker', {
  trackerName: uniqueTrackerName, 
  positionFiltering: 'TimeBased', // (Optional) Keeps cost low by filtering jitter
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

const trackerPolicy = new PolicyStatement({
  actions: [
    'geo:BatchUpdateDevicePosition', // For Agents
    'geo:GetDevicePosition',         // For Manager
    'geo:ListDevicePositions',       // For Manager (Fleet View)
    'geo:BatchGetDevicePosition'
  ],
  resources: [myTracker.attrArn],
});

const routesPolicy = new PolicyStatement({
  actions: [
    'geo-routes:CalculateRoutes', // Allows calculating A to B routes
    'geo-routes:CalculateRouteMatrix' // (Optional) If you ever want matrix on frontend
  ],
  resources: ['*'], // Gen 2 Routing is a region-wide service, not a specific resource
});
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(routesPolicy);
Object.values(backend.auth.resources.groups).forEach((groupResource) => {
  groupResource.role.addToPrincipalPolicy(routesPolicy);
});

// 4. Grant Map Permissions
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);
backend.auth.resources.unauthenticatedUserIamRole.addToPrincipalPolicy(geoPolicy);
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(trackerPolicy);

Object.values(backend.auth.resources.groups).forEach((groupResource) => {
  groupResource.role.addToPrincipalPolicy(geoPolicy);
  groupResource.role.addToPrincipalPolicy(trackerPolicy);
});

// 5. Export Configuration for Frontend
backend.addOutput({
  geo: {
    aws_region: geoStack.region,
    maps: {
      items: {
        [uniqueMapName]: { style: 'VectorEsriNavigation' },
      },
      default: uniqueMapName,
    },
  },
  custom: {
    amazon_location_service: {
      trackers: {
        items: [uniqueTrackerName],
        default: uniqueTrackerName,
      },
    },
  },
});

// 6. Grant Route Optimization Permissions
backend.optimizeDelivery.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['geo-routes:CalculateRouteMatrix'],
  resources: ['*'],
}));

// ====================================================
// 🟢 3. VIP OFFER PERMISSIONS & CONFIGURATION
// ====================================================

// Grant the VIP Offer Lambda permission to Read and Write to the BusinessData table
businessTable.grantReadWriteData(backend.sendVipOffer.resources.lambda);

// Pass the exact DynamoDB Table Name as an Environment Variable to the Lambda
backend.sendVipOffer.addEnvironment("BUSINESS_DATA_TABLE", businessTable.tableName);
backend.generateVipRecommendationsLambda.addEnvironment("BUSINESS_DATA_TABLE", businessTable.tableName);
businessTable.grantReadWriteData(backend.generateVipRecommendationsLambda.resources.lambda);

backend.generateVipRecommendationsLambda.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      'arn:aws:bedrock:us-east-1::foundation-model/*',
      'arn:aws:bedrock:us-east-1:*:inference-profile/*' // 🟢 NEW: Allows Amazon Nova cross-region profiles
    ],
  })
);

// ====================================================
// 🟢 4. EVENTBRIDGE SCHEDULE (TWICE DAILY AI AGENT)
// ====================================================
const vipAiFunction = backend.generateVipRecommendationsLambda.resources.lambda;

// Define a schedule: Twice a day (9:00 AM and 9:00 PM UTC)
const dailyRule = new Rule(backend.createStack('MarketingScheduleStack'), 'VipAiScheduleRule', {
  schedule: Schedule.expression('cron(0 9,21 * * ? *)'),
});

// Add your Lambda as the target for this rule
dailyRule.addTarget(new LambdaFunction(vipAiFunction));