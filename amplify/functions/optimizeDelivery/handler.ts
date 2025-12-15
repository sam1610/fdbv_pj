// import { GeoRoutesClient, CalculateRouteMatrixCommand } from "@aws-sdk/client-geo-routes";

// const client = new GeoRoutesClient({ region: "us-east-1" });

// export const handler = async (event: any) => {
//   console.log("Event received:", JSON.stringify(event));

//   // 1. Parse Arguments
//   let { orders, agents, restaurantLocation } = event.arguments;
  
//   if (typeof orders === 'string') orders = JSON.parse(orders);
//   if (typeof agents === 'string') agents = JSON.parse(agents);
//   if (typeof restaurantLocation === 'string') restaurantLocation = JSON.parse(restaurantLocation);

//   if (!orders.length || !agents.length) {
//     return { proposal: [] };
//   }

//   // The SDK expects: { Position: [long, lat] }
  
//   const origins = [
//     { 
//       Position: [restaurantLocation.longitude, restaurantLocation.latitude] 
//     }
//   ];

//   const destinations = orders.map((order: any) => {
//     const loc = typeof order.location === 'string' ? JSON.parse(order.location) : order.location;
//     return { 
//       Position: [loc.longitude, loc.latitude] 
//     };
//   });

//   try {
//     // 3. Call AWS to get Driving Durations
//     const command = new CalculateRouteMatrixCommand({
//       Origins: origins,
//       Destinations: destinations,
//       TravelMode: "Car",
//       RoutingBoundary: { Unbounded: true }
//     });

//     const matrixResponse = await client.send(command);
//     const routeRows = matrixResponse.RouteMatrix?.[0]; // From Origin 0 (Restaurant)

//     // 4. Perform Allocation Logic (Round-Robin Distribution)
//     const proposal = agents.map((agent: any) => ({
//       agentId: agent.id,
//       assignedOrders: [] as string[]
//     }));

//     orders.forEach((order: any, index: number) => {
//       // Round-robin assignment
//       const agentIndex = index % agents.length;
      
//       const duration = routeRows?.[index]?.Duration || 0;
//       console.log(`Order ${order.sk} is ${duration} seconds away.`);

//       proposal[agentIndex].assignedOrders.push(order.sk);
//     });

//     return { proposal };

//   } catch (error: any) {
//     console.error("Optimization Error:", error);
//     throw new Error(error.message || "Failed to calculate routes");
//   }
// };

// import { GeoRoutesClient, CalculateRouteMatrixCommand } from "@aws-sdk/client-geo-routes";

// const client = new GeoRoutesClient({ region: "us-east-1" });

// export const handler = async (event: any) => {
//   console.log("Event received:", JSON.stringify(event));

//   let { orders, agents, restaurantLocation } = event.arguments;
  
//   // Safe Parsing
//   if (typeof orders === 'string') orders = JSON.parse(orders);
//   if (typeof agents === 'string') agents = JSON.parse(agents);
//   if (typeof restaurantLocation === 'string') restaurantLocation = JSON.parse(restaurantLocation);

//   // Return empty if no orders (but allow empty agents if we just want distances)
//   if (!orders.length) {
//     return { proposal: [], routeMetrics: [] };
//   }

//   // 1. Prepare Coordinates
//   const origins = [{ 
//     Position: [restaurantLocation.longitude, restaurantLocation.latitude] 
//   }];

//   const destinations = orders.map((order: any) => {
//     const loc = typeof order.location === 'string' ? JSON.parse(order.location) : order.location;
//     return { 
//       Position: [loc.longitude, loc.latitude] 
//     };
//   });

//   try {
//     // 2. Call AWS Geo Routes
//     const command = new CalculateRouteMatrixCommand({
//       Origins: origins,
//       Destinations: destinations,
//       TravelMode: "Car",
//       RoutingBoundary: { Unbounded: true }
//     });

//     const matrixResponse = await client.send(command);
    
//     // AWS returns a matrix. Since we have 1 Origin, we take the first row.
//     const routeRows = matrixResponse.RouteMatrix?.[0]; 

//     // 3. Prepare Logic
//     // If we have agents, we do the round-robin assignment.
//     // If agents list is empty (e.g. history view), we just return distances.
    
//     const proposal = (agents && agents.length > 0) ? agents.map((agent: any) => ({
//       agentId: agent.id,
//       assignedOrders: [] as string[]
//     })) : [];

//     const routeMetrics: any[] = [];

//     orders.forEach((order: any, index: number) => {
//       // A. Extract Metric
//       const matrixEntry = routeRows?.[index];
//       const durationSeconds = matrixEntry?.Duration || 0;
//       const distanceMeters = matrixEntry?.Distance || 0; // Capture Distance

//       routeMetrics.push({
//         orderId: order.sk,
//         durationSeconds: durationSeconds,
//         distanceMeters: distanceMeters,
//         distanceKm: (distanceMeters / 1000).toFixed(2) // Convenience field
//       });

//       // B. Assign Agent (Round Robin) - Only if agents exist
//       if (agents && agents.length > 0) {
//         const agentIndex = index % agents.length;
//         proposal[agentIndex].assignedOrders.push(order.sk);
//       }
//     });

//     // Return BOTH the proposal (for dispatch) and metrics (for table view)
//     return { proposal, routeMetrics };

//   } catch (error: any) {
//     console.error("Optimization Error:", error);
//     throw new Error(error.message || "Failed to calculate routes");
//   }
// };

import { GeoRoutesClient, CalculateRouteMatrixCommand } from "@aws-sdk/client-geo-routes";

const client = new GeoRoutesClient({ region: "us-east-1" });

export const handler = async (event: any) => {
  let { orders, agents, agentLocation } = event.arguments;

  // Safe Parsing
  if (typeof orders === 'string') orders = JSON.parse(orders);
  if (typeof agentLocation === 'string') agentLocation = JSON.parse(agentLocation);

  if (!orders || orders.length === 0) return { proposal: [], routeMetrics: [] };

  // 1. ORIGIN: The Agent's Current Location (Single Point)
  // If no live location passed, fallback to the first order's restaurant (not ideal but safe)
  const originLat = parseFloat(agentLocation?.latitude || agentLocation?.lat);
  const originLng = parseFloat(agentLocation?.longitude || agentLocation?.lng);
  
  const origins = [{ 
      Position: [originLng, originLat] 
  }];

  // 2. DESTINATIONS: Dynamic based on Status
  const destinations = orders.map((order: any) => {
    let targetLat, targetLng;

    if (order.orderStatus === 'DELIVERING') {
       // Target is CUSTOMER
       const loc = typeof order.location === 'string' ? JSON.parse(order.location) : order.location;
       targetLat = parseFloat(loc?.latitude?.N || loc?.latitude);
       targetLng = parseFloat(loc?.longitude?.N || loc?.longitude);
    } else {
       // Target is RESTAURANT (Pick up)
       // We assume the frontend passed the restaurant location into the order object
       const loc = typeof order.restaurantLocation === 'string' ? JSON.parse(order.restaurantLocation) : order.restaurantLocation;
       targetLat = parseFloat(loc?.latitude);
       targetLng = parseFloat(loc?.longitude);
    }

    return { Position: [targetLng, targetLat] };
  });

  try {
    // 3. Calculate 1-to-N Matrix
    // AWS will calculate route from Agent -> Order 1, Agent -> Order 2, etc.
    const command = new CalculateRouteMatrixCommand({
      Origins: origins,
      Destinations: destinations,
      TravelMode: "Car",
      RoutingBoundary: { Unbounded: true }
    });

    const matrixResponse = await client.send(command);
    
    // Since we have 1 Origin, we only look at the first row of results
    const routeRow = matrixResponse.RouteMatrix?.[0]; 

    // 4. Extract Metrics
    const routeMetrics = orders.map((order: any, index: number) => {
      const routeData = routeRow?.[index];
      
      return {
        orderId: order.sk,
        // This is now "Time for Agent to arrive", not "Total Trip time"
        durationSeconds: routeData?.Duration || 0, 
        distanceMeters: routeData?.Distance || 0,
        distanceKm: ((routeData?.Distance || 0) / 1000).toFixed(2)
      };
    });

    return { proposal: [], routeMetrics };

  } catch (error: any) {
    console.error("Optimization Error:", error);
    throw new Error("Failed to calculate routes");
  }
};