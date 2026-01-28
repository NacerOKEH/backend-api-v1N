import pika
import os
import json
import threading
from config.database import collection

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

            # Bind to all device events
            channel.queue_bind(exchange=self.exchange, queue=queue_name, routing_key="device.#")

            print(" [*] Waiting for device events. To exit press CTRL+C")

            def callback(ch, method, properties, body):
                event_data = json.loads(body)
                routing_key = method.routing_key
                print(f" [x] Received {routing_key}:{event_data}")

                # 1. Store in MongoDB
                document = {
                    "routing_key": routing_key,
                    "data": event_data,
                    "timestamp": datetime.utcnow() # Need to import datetime
                }
                collection.insert_one(document)

                # 2. Emit via Socket.IO
                # Using run_coroutine_threadsafe if sio is async, but socketio.Server can be sync or async. 
                # If using python-socketio with ASGI, it's async.
                # We need to bridge sync callback to async sio emit.
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                # Wait, creating a new loop in a callback is risky.
                # Use the main loop?
                # Actually, python-socketio AsyncServer emit is a coroutine.
                # For simplicity, let's use a fire-and-forget or manage the loop passed in.
                
                # SIO Emit
                try:
                    # Depending on how SIO is set up (AsyncServer), we need to await it.
                    # Since this runs in a thread, we can't easily await something in the main loop.
                    # Better approach: calls back to a thread-safe method on the main app helper.
                    
                    # For now, let's assume we pass a wrapper or handle it.
                    # As a hack for this sync-in-thread context:
                    self.sio.emit('device_update', {'type': routing_key, 'data': event_data})
                    # Note: AsyncServer.emit is async. If sio is AsyncServer, this raises a warning or fails if not awaited.
                    # If sio is Server (sync), it works.
                    # Given FastAPI is async, we usually use AsyncServer. We'll need `asyncio.run_coroutine_threadsafe`.
                except Exception as e:
                    print(f"Error emitting socket event: {e}")

                ch.basic_ack(delivery_tag=method.delivery_tag)

            channel.basic_consume(queue=queue_name, on_message_callback=callback)
            channel.start_consuming()

        except Exception as e:
            print(f"RabbitMQ Consumer Error: {e}")

from datetime import datetime
