import pika
import time
import json
import os
import requests
import psutil
from dotenv import load_dotenv

load_dotenv()

# RabbitMQ Config
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "guest")

# Device API Config
DEVICE_API_URL = os.getenv("DEVICE_API_URL", "http://localhost:8001").rstrip("/")
EXCHANGE_NAME = "device_events"

def get_connection():
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
    parameters = pika.ConnectionParameters(host=RABBITMQ_HOST, port=RABBITMQ_PORT, credentials=credentials)
    
    while True:
        try:
            connection = pika.BlockingConnection(parameters)
            print("Connected to RabbitMQ!")
            return connection
        except pika.exceptions.AMQPConnectionError as e:
            print(f"Connection failed, retrying in 5s: {e}")
            time.sleep(5)

def ensure_host_device():
    """Ensure a Host PC device exists"""
    try:
        # Check if already exists
        try:
            response = requests.get(f"{DEVICE_API_URL}/devices/")
            if response.status_code == 200:
                devices = response.json()
                for d in devices:
                    if d.get('city') == 'Local':
                        print(f"Found existing Host PC: {d['device_id']}")
                        return d['device_id']
        except Exception:
            pass

        # Create if not exists
        print("Creating Host PC device...")
        payload = {
            "name": "Host PC",
            "type": "Server",
            "city": "Local",
            "ip_address": "127.0.0.1",
            "mac_address": "00:00:00:00:00:00",
            "firmware_version": "v1.0",
            "latitude": "0",
            "longitude": "0"
        }
        res = requests.post(f"{DEVICE_API_URL}/devices/", json=payload)
        if res.status_code in [200, 201]:
            data = res.json()
            print(f"Created Host PC: {data['device_id']}")
            return data['device_id']
    except Exception as e:
        print(f"Error ensuring host device: {e}")
    return None

def main():
    while True:
        try:
            connection = get_connection()
            channel = connection.channel()
            
            # Declare exchange
            channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type='topic', durable=True)

            # Ensure Host Device Exists
            host_id = ensure_host_device()
            if not host_id:
                print("Could not register Host PC. Retrying in 10s...")
                time.sleep(10)
                if connection and connection.is_open:
                    connection.close()
                continue

            print(f"Monitoring started for device: {host_id}")
            
            while True:
                # Get REAL system stats
                cpu = psutil.cpu_percent(interval=1)
                ram = psutil.virtual_memory().percent
                disk = psutil.disk_usage('/').percent
                
                payload = {
                    "device_id": host_id,
                    "city": "Local",
                    "cpu_usage": round(cpu, 1),
                    "ram_usage": round(ram, 1),
                    "disk_usage": round(disk, 1),
                    "temperature": 0,
                    "humidity": 0,
                    "timestamp": time.time()
                }
                
                routing_key = f"cloud-security-iot.iot.telemetry.{host_id}"
                
                channel.basic_publish(
                    exchange=EXCHANGE_NAME,
                    routing_key=routing_key,
                    body=json.dumps(payload)
                )
                print(f"[>] Published Host Stats: CPU {cpu}% | RAM {ram}% | Disk {disk}%")
                
                time.sleep(4) 

        except pika.exceptions.AMQPConnectionError as e:
            print(f"RabbitMQ Connection lost: {e}. Retrying in 5s...")
            time.sleep(5)
        except KeyboardInterrupt:
            print("Stopping monitor")
            if 'connection' in locals() and connection and connection.is_open:
                connection.close()
            break
        except Exception as e:
            print(f"Unexpected Error: {e}. Retrying in 5s...")
            time.sleep(5)
            try:
                if 'connection' in locals() and connection and connection.is_open:
                    connection.close()
            except:
                pass

if __name__ == "__main__":
    main()
