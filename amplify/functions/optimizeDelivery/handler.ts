import { GeoRoutesClient, CalculateRouteMatrixCommand } from "@aws-sdk/client-geo-routes";

const client = new GeoRoutesClient({ region: "us-east-1" });

export const handler = async (event: any) => {
  console.log("Event received:", JSON.stringify(event));

  // 1. Parse Arguments
  let { orders, agents, restaurantLocation } = event.arguments;
  
  if (typeof orders === 'string') orders = JSON.parse(orders);
  if (typeof agents === 'string') agents = JSON.parse(agents);
  if (typeof restaurantLocation === 'string') restaurantLocation = JSON.parse(restaurantLocation);

  if (!orders.length || !agents.length) {
    return { proposal: [] };
  }

  // The SDK expects: { Position: [long, lat] }
  
  const origins = [
    { 
      Position: [restaurantLocation.longitude, restaurantLocation.latitude] 
    }
  ];

  const destinations = orders.map((order: any) => {
    const loc = typeof order.location === 'string' ? JSON.parse(order.location) : order.location;
    return { 
      Position: [loc.longitude, loc.latitude] 
    };
  });

  try {
    // 3. Call AWS to get Driving Durations
    const command = new CalculateRouteMatrixCommand({
      Origins: origins,
      Destinations: destinations,
      TravelMode: "Car",
      RoutingBoundary: { Unbounded: true }
    });

    const matrixResponse = await client.send(command);
    const routeRows = matrixResponse.RouteMatrix?.[0]; // From Origin 0 (Restaurant)

    // 4. Perform Allocation Logic (Round-Robin Distribution)
    const proposal = agents.map((agent: any) => ({
      agentId: agent.id,
      assignedOrders: [] as string[]
    }));

    orders.forEach((order: any, index: number) => {
      // Round-robin assignment
      const agentIndex = index % agents.length;
      
      const duration = routeRows?.[index]?.Duration || 0;
      console.log(`Order ${order.sk} is ${duration} seconds away.`);

      proposal[agentIndex].assignedOrders.push(order.sk);
    });

    return { proposal };

  } catch (error: any) {
    console.error("Optimization Error:", error);
    throw new Error(error.message || "Failed to calculate routes");
  }
};