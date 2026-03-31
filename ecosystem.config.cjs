module.exports = {
  apps: [
    {
      name: 'dev-bank-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
    },
    {
      name: 'dev-bank-web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'https://dev-bank.hollywoodsoft.com/api',
      },
    },
  ],
};
