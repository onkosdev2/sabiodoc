from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.models.chat_message import MessageRole
from app.schemas.consultation import ConsultationStructuredIntake


class ChatMessageCreate(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    id: int
    consultation_id: int
    role: MessageRole
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse


class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessageResponse]
    consultation_id: int
    specialty_name: str


class GenerateSummaryResponse(BaseModel):
    summary: str
    consultation_id: int
    intake: Optional[ConsultationStructuredIntake] = None
