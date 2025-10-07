import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    // このハンドラは、API Gatewayからのリクエストを処理します。
    // 今はまだ何もしませんが、最終的にはDynamoDBにアイテムを追加するロジックをここに記述します。

    console.log('event:', JSON.stringify(event, null, 2));

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Hello from create function!',
        }),
    };
};