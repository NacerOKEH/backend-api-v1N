FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY local_monitor.py .

CMD ["python", "local_monitor.py"]
