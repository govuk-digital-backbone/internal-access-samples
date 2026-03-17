FROM node:22-slim
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY app.js ./
COPY views/ views/

ENV PORT=8080
CMD ["node", "app.js"]
