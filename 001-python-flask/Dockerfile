FROM python:3.12-slim
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml .
RUN uv pip install --system --no-cache -e .

COPY app.py ./
COPY templates/ templates/

ENV PORT=8080
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=8080"]
