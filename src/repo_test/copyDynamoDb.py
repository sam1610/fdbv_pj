import boto3
from boto3.dynamodb.types import TypeSerializer, TypeDeserializer
from threading import Thread, Lock
import time
import math

class DynamoDBCopier:
    def __init__(self, source_table, destination_table, region='us-east-1', max_workers=10):
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.client = boto3.client('dynamodb', region_name=region)
        self.source_table = self.dynamodb.Table(source_table)
        self.destination_table = self.dynamodb.Table(destination_table)
        self.max_workers = max_workers
        self.serializer = TypeSerializer()
        self.deserializer = TypeDeserializer()
        self.lock = Lock()
        self.processed_count = 0
        self.error_count = 0
        
    def scan_table(self, exclusive_start_key=None):
        """Scan table with pagination"""
        scan_kwargs = {
            'ReturnConsumedCapacity': 'TOTAL'
        }
        
        if exclusive_start_key:
            scan_kwargs['ExclusiveStartKey'] = exclusive_start_key
            
        response = self.source_table.scan(**scan_kwargs)
        return response
    
    def deserialize_item(self, item):
        """Convert DynamoDB JSON to Python types"""
        return {k: self.deserializer.deserialize(v) for k, v in item.items()}
    
    def serialize_item(self, item):
        """Convert Python types to DynamoDB JSON"""
        return {k: self.serializer.serialize(v) for k, v in item.items()}
    
    def batch_write_items(self, items):
        """Write batch of items to destination table"""
        if not items:
            return
            
        with self.dynamodb.Table(self.destination_table.name).batch_writer() as batch:
            for item in items:
                try:
                    batch.put_item(Item=item)
                    with self.lock:
                        self.processed_count += 1
                except Exception as e:
                    with self.lock:
                        self.error_count += 1
                    print(f"Error writing item: {e}")
    
    def copy_table_parallel(self):
        """Copy table using parallel processing"""
        print(f"Starting copy from {self.source_table.name} to {self.destination_table.name}")
        start_time = time.time()
        
        # Get initial scan
        response = self.scan_table()
        items = response.get('Items', [])
        total_items = response.get('Count', 0)
        last_evaluated_key = response.get('LastEvaluatedKey')
        
        # Process first batch
        threads = []
        if items:
            thread = Thread(target=self.batch_write_items, args=(items,))
            thread.start()
            threads.append(thread)
        
        # Continue scanning and processing
        while last_evaluated_key:
            response = self.scan_table(last_evaluated_key)
            batch_items = response.get('Items', [])
            total_items += response.get('Count', 0)
            last_evaluated_key = response.get('LastEvaluatedKey')
            
            if batch_items:
                thread = Thread(target=self.batch_write_items, args=(batch_items,))
                thread.start()
                threads.append(thread)
                
                # Limit number of concurrent threads
                if len(threads) >= self.max_workers:
                    for t in threads:
                        t.join()
                    threads = []
                    
                    # Progress update
                    print(f"Progress: {self.processed_count} items copied...")
        
        # Wait for remaining threads
        for thread in threads:
            thread.join()
            
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"\nCopy completed!")
        print(f"Total items scanned: {total_items}")
        print(f"Successfully copied: {self.processed_count}")
        print(f"Errors: {self.error_count}")
        print(f"Duration: {duration:.2f} seconds")
        if duration > 0:
            print(f"Rate: {self.processed_count/duration:.2f} items/second")

def main():
    # Configuration
    SOURCE_TABLE = "BusinessData-yqug5zclbzgvneztgfii3ejoke-NONE"
    DESTINATION_TABLE = "BusinessData-7j2pa4744bh6doqvqh73xkopym-NONE"
    REGION = "us-east-1"
    MAX_WORKERS = 15  # Adjust based on your table's capacity
    
    # Initialize copier
    copier = DynamoDBCopier(
        source_table=SOURCE_TABLE,
        destination_table=DESTINATION_TABLE,
        region=REGION,
        max_workers=MAX_WORKERS
    )
    
    # Execute copy
    copier.copy_table_parallel()

if __name__ == "__main__":
    main()