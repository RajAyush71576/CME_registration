<<<<<<< HEAD
FROM python:3.11-slim

WORKDIR /app
=======
FROM python:3.12-slim

WORKDIR /app/backend
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

EXPOSE 8000

<<<<<<< HEAD
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
=======
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5
