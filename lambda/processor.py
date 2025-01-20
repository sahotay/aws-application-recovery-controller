import boto3
import json
import os

# Initialize AWS services
sqs = boto3.client('sqs')
queue_url = os.environ['QUEUE_URL']

def lambda_handler(event, context):
    # Check HTTP method
    http_method = event.get('httpMethod')
    
    if http_method == 'POST':
        # Process POST request
        try:
            body = json.loads(event['body'])
            
            # Validate message contents
            if 'name' not in body or 'data' not in body:
                raise Exception("Missing 'name' or 'data' in message")
            
            # Send message to SQS
            response = sqs.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps(body)
            )
            
            return {
                "statusCode": 200,
                "body": json.dumps({
                    "message": "Message sent to SQS",
                    "id": response['MessageId']
                })
            }
        except Exception as e:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": str(e)})
            }
    
    elif http_method == 'GET':
        # Process GET request to check region
        try:
            region = os.environ['AWS_REGION']
            
            if region == 'us-east-1':
                message = "You are in us-east-1"
            elif region == 'us-west-2':
                message = "You are in us-west-2"
            else:
                message = f"You are in {region}"
            
            return {
                "statusCode": 200,
                "body": json.dumps({"message": message})
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "body": json.dumps({"error": "Unable to fetch region information"})
            }
    
    else:
        # Handle unsupported methods
        return {
            "statusCode": 405,
            "body": json.dumps({"error": "Method not allowed"})
        }
