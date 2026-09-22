from pydantic import BaseModel, ConfigDict, Field
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
    
    model_config = ConfigDict(from_attributes=True)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
    # True cuando la respuesta cierra la pre-consulta y adjunta el resumen final.
    summary_generated: bool = False


class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessageResponse]
    consultation_id: int
    specialty_name: str


class GenerateSummaryResponse(BaseModel):
    summary: str
    consultation_id: int
    intake: Optional[ConsultationStructuredIntake] = None
