from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, Dict, Any

class RegisterSchema(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("username")
    @classmethod
    def username_rules(cls, v: str):
        if not (2 <= len(v) <= 30):
            raise ValueError("username length 3-30")
        if not v.replace("_","").replace("-","").isalnum():
            raise ValueError("username must be alnum/_/-")
        return v

class LoginSchema(BaseModel):
    email: EmailStr
    password: str

class CreateDocSchema(BaseModel):
    title: str
    description: Optional[str] = None
    content: Optional[Dict[str, Any]] = None

class UpdateDocSchema(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[Dict[str, Any]] = None