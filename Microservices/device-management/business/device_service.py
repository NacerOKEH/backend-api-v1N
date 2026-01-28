from sqlalchemy.orm import Session
from dal.device_dal import DeviceDAL
from dto.device_dto import DeviceCreate, DeviceUpdate
from helpers.rabbitmq_helper import rabbitmq_helper

class DeviceService:
    def __init__(self, db: Session):
        self.dal = DeviceDAL(db)

    def create_device(self, device: DeviceCreate):
        created_device = self.dal.create_device(device)
        # Publish event
        rabbitmq_helper.publish_event(
            routing_key="device.created",
            message={"device_id": created_device.device_id, "status": created_device.status}
        )
        return created_device

    def get_device(self, device_id: str):
        return self.dal.get_device(device_id)

    def get_all_devices(self, skip: int = 0, limit: int = 100):
        return self.dal.get_all_devices(skip, limit)

    def update_device(self, device_id: str, device_update: DeviceUpdate):
        updated_device = self.dal.update_device(device_id, device_update)
        if updated_device:
             # Publish event
            rabbitmq_helper.publish_event(
                routing_key="device.updated",
                message={
                    "device_id": updated_device.device_id, 
                    "status": updated_device.status,
                    "updated_fields": list(device_update.model_dump(exclude_unset=True).keys())
                }
            )
        return updated_device

    def delete_device(self, device_id: str):
        deleted_device = self.dal.delete_device(device_id)
        if deleted_device:
             rabbitmq_helper.publish_event(
                routing_key="device.deleted",
                message={"device_id": device_id}
            )
        return deleted_device
