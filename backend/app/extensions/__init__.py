from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import os

db = SQLAlchemy()
jwt = JWTManager()
socketio = SocketIO(cors_allowed_origins="*", message_queue=None)  # set Redis URL later
limiter = Limiter(key_func=get_remote_address, 
                  storage_uri=os.getenv("LIMITER_STORAGE_URI", "memory://") # Redis in prod
                  )