# 🚀 Guide de Démarrage Rapide (QuickStart)

Ce guide t'explique comment lancer chaque partie du projet **Smart City IoT**.

## 1. Démarrage Recommandé (Mode Automatique) : Docker 🐳

C'est la méthode la plus simple. Elle lance tout d'un coup.

### Lancer tous les services
Ouvre un terminal à la racine (`backend-api-v1N`) et lance :
```powershell
docker-compose up -d --build
```
> Cela va lancer : Postgres, RabbitMQ, Mosquitto, Device-Management, Monitoring, Signing, Simulator.

### Vérifier que tout tourne
```powershell
docker ps
```
Tu devrais voir 7 conteneurs actifs.

### Accès
- **Dashboard Frontend** : [http://localhost:5173](http://localhost:5173) (Si tu as lancé le frontend `npm run dev`)
- **Device Management API** : [http://localhost:8001/docs](http://localhost:8001/docs)
- **Monitoring API** : [http://localhost:8002/docs](http://localhost:8002/docs)
- **Signing API** : [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 2. Démarrage Ciblé (Service par Service)

Si tu veux juste lancer la partie **Device Management** :

```powershell
docker-compose up -d device-management
```
*(Cela lancera aussi les dépendances nécessaires : Postgres, RabbitMQ, Mosquitto)*

---

## 3. Lancer le Frontend (Client React)

Le frontend n'est pas dans le docker-compose principal pour le développement.
```powershell
cd client
npm install   # Une seule fois au début
npm run dev
```

---

## 4. Démarrage Manuel (Sans Docker pour le code Python)
*Utile seulement pour le débugging.*

Il faut d'abord lancer l'infrastructure :
```powershell
docker-compose up -d postgres rabbitmq mosquitto
```

Puis configurer et lancer le script Python (Windows PowerShell) :
```powershell
$env:POSTGRES_PASSWORD="password"
$env:SERVER_DB="localhost"
$env:MQTT_HOST="localhost"
$env:RABBITMQ_HOST="localhost"

cd Microservices/device-management
python main.py
```
