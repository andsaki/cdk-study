import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

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

    const command = new DeleteCommand({
        TableName: tableName,
        Key: { id }, // 削除対象のアイテムのキー
    });

    try {
        await docClient.send(command);
        return {
            statusCode: 204, // 204 No Content
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: '',
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({ message: 'Failed to delete todo item.' }),
        };
    }
};