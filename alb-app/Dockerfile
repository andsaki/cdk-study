# Node.js 20 Alpine イメージを使用（軽量）
FROM node:20-alpine

# 作業ディレクトリを作成
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# アプリケーションのソースコードをコピー
COPY . .

# ポート3000を公開
EXPOSE 3000

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# アプリケーションを起動
CMD ["node", "server.js"]
