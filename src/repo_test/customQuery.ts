interface AProps {
  user: { username: string; attributes?: Record<string, unknown> } | null;
  client: ReturnType<typeof generateClient<Schema>>;
  phoneNbr: string;
}

// Custom type for limited response (adjust fields to match your selection set)
type LimitedBusinessData = Pick<BusinessData, 'pk' | 'sk' | 'entityType' | 'name' | 'orderStatus'>;

function BusinessByStatus({ user, client, phoneNbr }: AProps) {
  const [data, setData] = useState<LimitedBusinessData[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async (token: string | null = null) => {
      if (token ? loadingMore : loading) return;
      token ? setLoadingMore(true) : setLoading(true);
      setError(null);
      try {
        const businessPk = `BUSINESS#${phoneNbr}`;

        // Custom GraphQL query string with limited selection set
        const query = `
          query listBusinessDataByBusinessByStatus(
            $gsi1pk: String!,
            $gsi1sk: ModelStringKeyConditionInput,
            $sortDirection: ModelSortDirection,
            $limit: Int,
            $nextToken: String
          ) {
            listBusinessDataByBusinessByStatus(
              gsi1pk: $gsi1pk,
              gsi1sk: $gsi1sk,
              sortDirection: $sortDirection,
              limit: $limit,
              nextToken: $nextToken
            ) {
              items {
                pk      # Only select desired fields here
                sk
                entityType
                name
                orderStatus
                # Add more if needed, e.g., orderDate, totalPrice
              }
              nextToken
            }
          }
        `;

        const variables = {
          gsi1pk: businessPk,
          gsi1sk: { beginsWith: 'ORDER#' }, // Filter only orders
          sortDirection: 'DESC', // Descending (newest first)
          limit: 10, // Pagination batch size
          nextToken: token,
        };

        const response = await client.graphql({ query, variables });
        const newData = response.data.listBusinessDataByBusinessByStatus.items || [];
        setData((prev) => [...prev, ...newData]);
        setNextToken(response.data.listBusinessDataByBusinessByStatus.nextToken || null);
        setHasMore(!!response.data.listBusinessDataByBusinessByStatus.nextToken);
      } catch (e) {
        console.error('Error fetching byBusinessByStatus:', e);
        setError('Failed to fetch byBusinessByStatus data');
      } finally {
        token ? setLoadingMore(false) : setLoading(false);
      }
    };

    if (user) {
      setData([]); // Reset on user/phoneNbr change
      setNextToken(null);
      setHasMore(true);
      fetchData();
    } else {
      setError('User not authenticated');
      setLoading(false);
    }
  }, [user, client, phoneNbr]);

  if (loading) return <p>Loading byBusinessByStatus...</p>;
  if (error) return <p>{error}</p>;

  return (
    <section>
      <h2>GSI 1: byBusinessByStatus</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>PK</th>
            <th>SK</th>
            <th>Entity Type</th>
            <th>Name</th>
            <th>Order Status</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((item) => (
              <tr key={`${item.pk}-${item.sk}`}>
                <td>{item.pk}</td>
                <td>{item.sk}</td>
                <td>{item.entityType}</td>
                <td>{item.name}</td>
                <td>{item.orderStatus}</td>
              </tr>
            ))
          ) : (
            <tr><td colSpan={5}>No data found.</td></tr>
          )}
        </tbody>
      </table>
      {hasMore && (
        <button onClick={() => fetchData(nextToken)} disabled={loadingMore}>
          {loadingMore ? 'Loading More...' : 'Load More'}
        </button>
      )}
    </section>
  );
}

export default BusinessByStatus;