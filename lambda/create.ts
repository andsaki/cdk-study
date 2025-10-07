import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
// AWS SDK for DynamoDBをインポート
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
// ユニークIDを生成するためのcryptoモジュール
import { randomUUID } from 'crypto';

// DynamoDBクライアントを初期化
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    // 環境変数からテーブル名を取得
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
        throw new Error('Table name is not defined in environment variables.');
    }

    // API Gatewayからのリクエストボディをパース
    if (!event.body) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Request body is missing' }),
        };
    }
    const { todo } = JSON.parse(event.body);

    // 新しいTODOアイテムを作成
    const newItem = {
        id: randomUUID(), // ユニークなIDを生成
        todo: todo,
        createdAt: new Date().toISOString(),
        completed: false,
    };

    // DynamoDBにアイテムを保存
    const command = new PutCommand({
        TableName: tableName,
        Item: newItem,
    });

    try {
        await docClient.send(command);
        return {
            statusCode: 201, // 201 Created
            body: JSON.stringify(newItem),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to create todo item.' }),
        };
    }
};