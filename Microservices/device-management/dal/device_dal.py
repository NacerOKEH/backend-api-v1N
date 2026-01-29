from sqlalchemy.orm import Session
from models.device import Device, DeviceStatus
from dto.device_dto import DeviceCreate, DeviceUpdate
import uuid

class DeviceDAL:
    def __init__(self, db: Session):
        self.db = db

    def create_device(self, device: DeviceCreate) -> Device:
        db_device = Device(
            device_id=str(uuid.uuid4()),
            name=device.name,
            type=device.type,
            ip_address=device.ip_address,
            mac_address=device.mac_address,
            firmware_version=device.firmware_version,
            latitude=device.latitude,
            longitude=device.longitude,
            city=device.city,
            status=DeviceStatus.OFFLINE
        )
        self.db.add(db_device)
        self.db.commit()
        self.db.refresh(db_device)
        return db_device

    def get_device(self, device_id: str) -> Device:
        return self.db.query(Device).filter(Device.device_id == device_id).first()

    def get_all_devices(self, skip: int = 0, limit: int = 100):
        return self.db.query(Device).offset(skip).limit(limit).all()

    def update_device(self, device_id: str, device_update: DeviceUpdate) -> Device:
        db_device = self.get_device(device_id)
        if not db_device:
            return None
        
        update_data = device_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_device, key, value)

        self.db.commit()
        self.db.refresh(db_device)
        return db_device

    def delete_device(self, device_id: str):
        db_device = self.get_device(device_id)
        if db_device:
            self.db.delete(db_device)
            self.db.commit()
        return db_device
