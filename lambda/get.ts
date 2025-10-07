import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
        throw new Error('Table name is not defined in environment variables.');
    }

    // DynamoDBから全アイテムをスキャン（取得）
    // 注意: Scanオペレーションはテーブル全体を読み込むため、大規模なテーブルでは非効率になる可能性があります。
    // 学習目的では問題ありません。
    const command = new ScanCommand({
        TableName: tableName,
    });

    try {
        const response = await docClient.send(command);
        return {
            statusCode: 200,
            body: JSON.stringify(response.Items),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to get todo items.' }),
        };
    }
};