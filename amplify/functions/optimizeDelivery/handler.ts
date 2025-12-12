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

import { GeoRoutesClient, CalculateRouteMatrixCommand } from "@aws-sdk/client-geo-routes";

const client = new GeoRoutesClient({ region: "us-east-1" });

export const handler = async (event: any) => {
  console.log("Event received:", JSON.stringify(event));

  let { orders, agents, restaurantLocation } = event.arguments;
  
  // Safe Parsing
  if (typeof orders === 'string') orders = JSON.parse(orders);
  if (typeof agents === 'string') agents = JSON.parse(agents);
  if (typeof restaurantLocation === 'string') restaurantLocation = JSON.parse(restaurantLocation);

  // Return empty if no orders (but allow empty agents if we just want distances)
  if (!orders.length) {
    return { proposal: [], routeMetrics: [] };
  }

  // 1. Prepare Coordinates
  const origins = [{ 
    Position: [restaurantLocation.longitude, restaurantLocation.latitude] 
  }];

  const destinations = orders.map((order: any) => {
    const loc = typeof order.location === 'string' ? JSON.parse(order.location) : order.location;
    return { 
      Position: [loc.longitude, loc.latitude] 
    };
  });

  try {
    // 2. Call AWS Geo Routes
    const command = new CalculateRouteMatrixCommand({
      Origins: origins,
      Destinations: destinations,
      TravelMode: "Car",
      RoutingBoundary: { Unbounded: true }
    });

    const matrixResponse = await client.send(command);
    
    // AWS returns a matrix. Since we have 1 Origin, we take the first row.
    const routeRows = matrixResponse.RouteMatrix?.[0]; 

    // 3. Prepare Logic
    // If we have agents, we do the round-robin assignment.
    // If agents list is empty (e.g. history view), we just return distances.
    
    const proposal = (agents && agents.length > 0) ? agents.map((agent: any) => ({
      agentId: agent.id,
      assignedOrders: [] as string[]
    })) : [];

    const routeMetrics: any[] = [];

    orders.forEach((order: any, index: number) => {
      // A. Extract Metric
      const matrixEntry = routeRows?.[index];
      const durationSeconds = matrixEntry?.Duration || 0;
      const distanceMeters = matrixEntry?.Distance || 0; // Capture Distance

      routeMetrics.push({
        orderId: order.sk,
        durationSeconds: durationSeconds,
        distanceMeters: distanceMeters,
        distanceKm: (distanceMeters / 1000).toFixed(2) // Convenience field
      });

      // B. Assign Agent (Round Robin) - Only if agents exist
      if (agents && agents.length > 0) {
        const agentIndex = index % agents.length;
        proposal[agentIndex].assignedOrders.push(order.sk);
      }
    });

    // Return BOTH the proposal (for dispatch) and metrics (for table view)
    return { proposal, routeMetrics };

  } catch (error: any) {
    console.error("Optimization Error:", error);
    throw new Error(error.message || "Failed to calculate routes");
  }
};