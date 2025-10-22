import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
        throw new Error('Table name is not defined in environment variables.');
    }

    const id = event.pathParameters?.id;
    if (!id) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({ message: 'ID is missing from path' }),
        };
    }

    const command = new GetCommand({
        TableName: tableName,
        Key: { id },
    });

    try {
        const response = await docClient.send(command);

        // アイテムが見つかったかどうかを確認
        if (response.Item) {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                body: JSON.stringify(response.Item),
            };
        } else {
            // アイテムが見つからなかった場合
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                body: JSON.stringify({ message: 'Todo item not found' }),
            };
        }
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({ message: 'Failed to get todo item.' }),
        };
    }
};