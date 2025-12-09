import boto3
from botocore.exceptions import ClientError

def migrate_categories():
    # 1. Configuration
    TABLE_NAME = "BusinessData-yqug5zclbzgvneztgfii3ejoke-NONE"
    REGION_NAME = "us-east-1" # Change this if your table is in a different region (e.g., eu-central-1)

    # 2. Initialize Boto3 Client
    dynamodb = boto3.resource('dynamodb', region_name=REGION_NAME)
    table = dynamodb.Table(TABLE_NAME)

    print(f"🚀 Starting migration on table: {TABLE_NAME}")

    try:
        # 3. Scan for all items where entityType = "orderItems"
        # Note: 'scan' is expensive on large tables. For small/demo tables, this is fine.
        response = table.scan(
            FilterExpression=boto3.dynamodb.conditions.Attr('entityType').eq('orderItems')
        )
        
        items = response.get('Items', [])
        print(f"Found {len(items)} order items to check.")

        # 4. Iterate and Update
        for item in items:
            pk = item['pk']
            sk = item['sk']
            
            # Determine the new category based on 'sk'
            if sk in ["ITEM#001", "ITEM#002"]:
                new_category = "SANDWICHES_WRAPS"
            else:
                new_category = "SIDES"

            # Check if update is actually needed (optimization)
            if item.get('itemCategory') == new_category:
                print(f"Skipping {sk} (Already correct)")
                continue

            print(f"Updating {sk}: Setting category to {new_category}...")

            # 5. Perform the Update
            table.update_item(
                Key={
                    'pk': pk,
                    'sk': sk
                },
                UpdateExpression="set itemCategory = :c",
                ExpressionAttributeValues={
                    ':c': new_category
                }
            )

        print("✅ Migration Complete!")

    except ClientError as e:
        print(f"❌ Error: {e.response['Error']['Message']}")
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")

if __name__ == "__main__":
    migrate_categories()