FROM python:3.12-slim
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./
COPY templates/ templates/

ENV PORT=8080
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=8080"]
