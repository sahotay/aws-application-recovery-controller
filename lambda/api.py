import boto3
import json
import os

sqs = boto3.client('sqs')
queue_url = os.getenv('QUEUE_URL')
if not queue_url:
    raise ValueError("Environment variable QUEUE_URL not set.")


def handler(event, context):
    body = json.loads(event['body'])
    response = sqs.send_message(
        QueueUrl=queue_url,
        MessageBody=json.dumps(body)
    )
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Message sent to SQS', 'id': response['MessageId']})
    }
