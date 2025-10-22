import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

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

    if (!event.body) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({ message: 'Request body is missing' }),
        };
    }
    // リクエストボディから更新する内容（todoのテキストや完了状態）を取得
    const { todo, completed } = JSON.parse(event.body);

    // UpdateExpressionを構築
    // SET句で更新する属性を指定し、ExpressionAttributeValuesでその値を渡す
    const command = new UpdateCommand({
        TableName: tableName,
        Key: { id }, // 更新対象のアイテムのキー
        UpdateExpression: 'set todo = :t, completed = :c',
        ExpressionAttributeValues: {
            ':t': todo,
            ':c': completed,
        },
        ReturnValues: 'ALL_NEW', // 更新後のアイテムを返すように指定
    });

    try {
        const response = await docClient.send(command);
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify(response.Attributes),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({ message: 'Failed to update todo item.' }),
        };
    }
};