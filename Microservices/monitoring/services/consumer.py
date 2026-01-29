import pika
import os
import json
import threading
from config.database import collection
from datetime import datetime

class DeviceEventConsumer(threading.Thread):
    def __init__(self, sio):
        threading.Thread.__init__(self)
        self.sio = sio
        self.host = os.getenv("RABBITMQ_HOST", "rabbitmq")
        self.port = int(os.getenv("RABBITMQ_PORT", 5672))
        self.user = os.getenv("RABBITMQ_USER", "guest")
        self.password = os.getenv("RABBITMQ_PASSWORD", "guest")
        self.exchange = "device_events"
        self.queue_name = "monitoring_queue"
        self.daemon = True # Daemon thread to exit when main program exits

    def run(self):
        try:
            # Retry logic for RabbitMQ connection
            while True:
                try:
                    credentials = pika.PlainCredentials(self.user, self.password)
                    parameters = pika.ConnectionParameters(host=self.host, port=self.port, credentials=credentials)
                    connection = pika.BlockingConnection(parameters)
                    break # Connection successful
                except pika.exceptions.AMQPConnectionError as e:
                    print(f"RabbitMQ Connection failed, retrying in 5s: {e}")
                    import time
                    time.sleep(5)
            channel = connection.channel()

            channel.exchange_declare(exchange=self.exchange, exchange_type='topic', durable=True)
            result = channel.queue_declare(queue=self.queue_name, exclusive=False, durable=True)
            queue_name = result.method.queue

            # Bind to all device events (Legacy + New AMQP)
            channel.queue_bind(exchange=self.exchange, queue=queue_name, routing_key="device.#")
            channel.queue_bind(exchange=self.exchange, queue=queue_name, routing_key="cloud-security-iot.iot.#")

            print(f" [*] Waiting for device events. To exit press CTRL+C")
            
            def callback(ch, method, properties, body):
                try:
                    event_data = json.loads(body)
                    routing_key = method.routing_key
                    
                    # Normalize type for Frontend (which expects 'device.telemetry')
                    frontend_event_type = routing_key
                    if routing_key.startswith("cloud-security-iot"):
                        frontend_event_type = "device.telemetry"

                    # 1. Store in MongoDB
                    try:
                        document = {
                            "routing_key": routing_key,
                            "data": event_data,
                            "timestamp": datetime.utcnow()
                        }
                        collection.insert_one(document)
                    except Exception as e:
                        print(f"Error saving to MongoDB: {e}")

                    # 2. Emit via Socket.IO
                    # self.sio is the SioWrapper passed from main.py, so .emit() is thread-safe
                    self.sio.emit('device_update', {'type': frontend_event_type, 'data': event_data})
                    
                except Exception as e:
                    print(f"Error processing message: {e}")

                ch.basic_ack(delivery_tag=method.delivery_tag)

            channel.basic_consume(queue=queue_name, on_message_callback=callback)
            channel.start_consuming()

        except Exception as e:
            print(f"RabbitMQ Consumer Error: {e}")
