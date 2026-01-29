import pika
import time
import json
import random
import os
import requests
import psutil
from dotenv import load_dotenv

load_dotenv()

# RabbitMQ Config
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
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

def fetch_devices():
    """Fetch list of devices from the Device Management API"""
    try:
        response = requests.get(f"{DEVICE_API_URL}/devices/")
        if response.status_code == 200:
            devices = response.json()
            # Convert to dict format {id: city}
            return {d['device_id']: d.get('city', 'Unknown') for d in devices}
    except Exception as e:
        print(f"Error fetching devices: {e}")
    return {}

def main():
    connection = get_connection()
    channel = connection.channel()
    
    # Declare exchange to ensure it exists
    channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type='topic', durable=True)

    try:
        while True:
            # 1. Fetch real devices from API
            active_devices = fetch_devices()
            
            if not active_devices:
                print("No devices found. Waiting...")
            
            for device_id, city in active_devices.items():
                
                # Get base stats from psutil (host stats)
                base_cpu = psutil.cpu_percent(interval=None)
                base_ram = psutil.virtual_memory().percent
                
                # Randomize per device to make them distinct
                # Add random offset (-10 to +10)
                device_cpu = max(0, min(100, base_cpu + random.uniform(-10, 10)))
                device_ram = max(0, min(100, base_ram + random.uniform(-5, 5)))

                payload = {
                    "device_id": device_id,
                    "city": city or "Unknown",
                    "temperature": round(random.uniform(5.0, 45.0), 2),
                    "humidity": round(random.uniform(20.0, 90.0), 2),
                    "cpu_usage": round(device_cpu, 1),
                    "ram_usage": round(device_ram, 1),
                    "timestamp": time.time()
                }
                
                # Routing key format: cloud-security-iot.iot.temperature.{device_id}
                routing_key = f"cloud-security-iot.iot.temperature.{device_id}"
                
                channel.basic_publish(
                    exchange=EXCHANGE_NAME,
                    routing_key=routing_key,
                    body=json.dumps(payload)
                )
                print(f"[>] Published for {device_id} ({city})")
                
            time.sleep(10) # Wait 10s between cycles
    except KeyboardInterrupt:
        print("Stopping simulation")
        connection.close()
    except Exception as e:
        print(f"Error: {e}")
        connection.close()

if __name__ == "__main__":
    main()
