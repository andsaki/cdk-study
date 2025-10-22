import { useState } from 'react';

// このURLはご自身の環境のAPI Gatewayエンドポイントに置き換えてください。
// cdk deploy完了時に出力される CdkStudyStack.TodoApiEndpoint... の値です。
const API_ENDPOINT = 'https://xaehrfojql.execute-api.ap-northeast-1.amazonaws.com/prod/';

function App() {
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTodo, setNewTodo] = useState('');

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

  const createTodo = async () => {
    if (!newTodo.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_ENDPOINT}todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ todo: newTodo }),
      });
      if (!response.ok) {
        throw new Error('TODOの作成に失敗しました。');
      }
      setNewTodo('');
      await fetchTodos(); // リストを再取得
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1>CDK React App</h1>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="新しいTODOを入力"
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <button onClick={createTodo} disabled={loading || !newTodo.trim()}>
          追加
        </button>
      </div>

      <button onClick={fetchTodos} disabled={loading}>
        {loading ? '読み込み中...' : 'TODOリストを取得'}
      </button>

      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}

      <h2>TODOリスト:</h2>
      {todos.length > 0 ? (
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>{todo.todo}</li>
          ))}
        </ul>
      ) : (
        <p>データがありません。TODOを追加してください。</p>
      )}
    </>
  );
}

export default App;