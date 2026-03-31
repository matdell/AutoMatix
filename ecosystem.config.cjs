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
        NEXT_PUBLIC_API_URL: 'https://bank1.automatixpay.com/api',
      },
    },
    {
      name: 'dev-bank-central',
      cwd: './apps/central-api',
      script: 'src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: '4001',
        SERVICE_NAME: 'central-api',
      },
    },
  ],
};
