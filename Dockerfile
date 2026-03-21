FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src/ src/
COPY scripts/ scripts/
RUN pip install --no-cache-dir .
RUN mkdir -p data

EXPOSE 8000

CMD ["uvicorn", "researchtide.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
