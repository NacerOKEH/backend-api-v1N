import pika
import os
import json

class RabbitMQHelper:
    def __init__(self):
        self.host = os.getenv("RABBITMQ_HOST", "rabbitmq")
        self.port = int(os.getenv("RABBITMQ_PORT", 5672))
        self.user = os.getenv("RABBITMQ_USER", "guest")
        self.password = os.getenv("RABBITMQ_PASSWORD", "guest")
        self.exchange = "device_events"
        self.connection = None
        self.channel = None

    def connect(self):
        try:
            credentials = pika.PlainCredentials(self.user, self.password)
            parameters = pika.ConnectionParameters(host=self.host, port=self.port, credentials=credentials)
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()
            self.channel.exchange_declare(exchange=self.exchange, exchange_type='topic', durable=True)
            print("Connected to RabbitMQ")
        except Exception as e:
            print(f"Failed to connect to RabbitMQ: {e}")
            # In production, you might want to retry or handle this better

    def publish_event(self, routing_key: str, message: dict):
        if not self.connection or self.connection.is_closed:
            self.connect()
        
        if self.channel and self.channel.is_open:
            try:
                self.channel.basic_publish(
                    exchange=self.exchange,
                    routing_key=routing_key,
                    body=json.dumps(message)
                )
                print(f"Published to {routing_key}: {message}")
            except Exception as e:
                print(f"Failed to publish message: {e}")
                
    def close(self):
        if self.connection and not self.connection.is_closed:
            self.connection.close()

rabbitmq_helper = RabbitMQHelper()
