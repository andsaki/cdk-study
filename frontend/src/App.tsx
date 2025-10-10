import { useState } from 'react';

// このURLはご自身の環境のAPI Gatewayエンドポイントに置き換えてください。
// cdk deploy完了時に出力される CdkStudyStack.TodoApiEndpoint... の値です。
const API_ENDPOINT = 'https://xaehrfojql.execute-api.ap-northeast-1.amazonaws.com/prod/';

function App() {
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTodos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_ENDPOINT}todos`);
      if (!response.ok) {
        throw new Error('データの取得に失敗しました。');
      }
      const data = await response.json();
      setTodos(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1>CDK React App</h1>
      <button onClick={fetchTodos} disabled={loading}>
        {loading ? '読み込み中...' : 'TODOリストを取得'}
      </button>

      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}

      <h2>TODOリスト:</h2>
      {todos.length > 0 ? (
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>{todo.title}</li>
          ))}
        </ul>
      ) : (
        <p>データがありません。ボタンを押して取得してください。</p>
      )}
    </>
  );
}

export default App;