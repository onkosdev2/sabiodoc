import json
from typing import Optional
from openai import OpenAI
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

TRIAGE_SYSTEM_PROMPT = """Eres un asistente médico de orientación. Tu rol es ayudar a los usuarios a identificar qué especialidad médica podría ser más apropiada para sus síntomas.

REGLAS IMPORTANTES:
1. NUNCA diagnostiques enfermedades específicas
2. NUNCA prescribas medicamentos
3. NUNCA minimices síntomas graves
4. Si detectas señales de emergencia (dolor torácico severo, dificultad respiratoria intensa, signos neurológicos agudos como parálisis o confusión, sangrado abundante, pérdida de consciencia), DEBES marcar urgency como "emergency"
5. Sé claro y calmado, evita lenguaje alarmista
6. Siempre incluye un disclaimer

ESPECIALIDADES DISPONIBLES (usa estos slugs exactos):
- medicina-interna: Problemas generales de salud en adultos
- cardiologia: Corazón y sistema cardiovascular
- neurologia: Sistema nervioso, cerebro, dolores de cabeza
- pediatria: Niños y adolescentes
- ginecologia: Salud femenina, embarazo
- traumatologia: Huesos, articulaciones, lesiones
- dermatologia: Piel, cabello, uñas
- oftalmologia: Ojos y visión
- otorrinolaringologia: Oídos, nariz, garganta
- psiquiatria: Salud mental
- gastroenterologia: Sistema digestivo
- endocrinologia: Hormonas, tiroides, diabetes
- urologia: Sistema urinario, próstata
- nefrologia: Riñones
- oncologia: Cáncer y tumores

Responde SIEMPRE en formato JSON válido con esta estructura exacta:
{
    "urgency": "low|medium|high|emergency",
    "recommended_specialty_slug": "slug-de-especialidad",
    "rationale_bullets": ["razón 1", "razón 2", "razón 3"],
    "clarifying_questions": ["pregunta 1", "pregunta 2"],
    "alternatives": [{"specialty_slug": "otro-slug", "reason": "razón"}],
    "red_flags_detected": ["señal de alarma si existe"],
    "disclaimer": "Esto es solo orientación. No reemplaza una consulta médica profesional. Si los síntomas empeoran, acude a urgencias."
}"""


class LLMClient:
    def __init__(self):
        self.api_key = settings.DEEPSEEK_API_KEY
        self.base_url = settings.DEEPSEEK_BASE_URL
        self.model = settings.DEEPSEEK_MODEL
        self.is_mock = not self.api_key
        
        if not self.is_mock:
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=f"{self.base_url}/v1" if not self.base_url.endswith("/v1") else self.base_url
            )
            logger.info(f"LLM Client initialized with model: {self.model}")
        else:
            logger.warning("LLM Client running in MOCK mode - no API key configured")
    
    def get_triage_response(
        self,
        symptoms_text: str,
        age: Optional[int] = None,
        sex: Optional[str] = None
    ) -> dict:
        if self.is_mock:
            return self._get_mock_response(symptoms_text)
        
        try:
            user_message = f"Síntomas del paciente: {symptoms_text}"
            if age:
                user_message += f"\nEdad: {age} años"
            if sex:
                sex_map = {"male": "masculino", "female": "femenino", "other": "otro"}
                user_message += f"\nSexo: {sex_map.get(sex, sex)}"
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": TRIAGE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.3,
                max_tokens=1000
            )
            
            content = response.choices[0].message.content
            
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            result = json.loads(content)
            logger.info(f"Triage completed: urgency={result.get('urgency')}")
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            return self._get_fallback_response()
        except Exception as e:
            logger.error(f"LLM API error: {e}")
            return self._get_fallback_response()
    
    def _get_mock_response(self, symptoms_text: str) -> dict:
        symptoms_lower = symptoms_text.lower()
        
        emergency_keywords = [
            "dolor torácico severo", "no puedo respirar", "dificultad para respirar",
            "parálisis", "no siento", "confusión", "desmayo", "sangrado abundante",
            "dolor de pecho intenso", "infarto", "derrame"
        ]
        
        for keyword in emergency_keywords:
            if keyword in symptoms_lower:
                return {
                    "urgency": "emergency",
                    "recommended_specialty_slug": "medicina-interna",
                    "rationale_bullets": [
                        "Los síntomas descritos pueden indicar una emergencia médica",
                        "Se requiere evaluación médica inmediata",
                        "No espere, acuda a urgencias o llame a emergencias"
                    ],
                    "clarifying_questions": [],
                    "alternatives": [],
                    "red_flags_detected": ["Posible emergencia médica detectada"],
                    "disclaimer": "⚠️ ATENCIÓN: Los síntomas que describes pueden ser una emergencia. Por favor, acude inmediatamente a urgencias o llama a servicios de emergencia. Esto no reemplaza atención médica profesional."
                }
        
        return {
            "urgency": "medium",
            "recommended_specialty_slug": "medicina-interna",
            "rationale_bullets": [
                "Medicina interna es un buen punto de partida para una evaluación general",
                "El especialista podrá derivarte a otra especialidad si es necesario",
                "Es importante una evaluación profesional de tus síntomas"
            ],
            "clarifying_questions": [
                "¿Hace cuánto tiempo presentas estos síntomas?",
                "¿Has tenido síntomas similares antes?",
                "¿Estás tomando algún medicamento actualmente?",
                "¿Tienes alguna condición médica conocida?"
            ],
            "alternatives": [
                {"specialty_slug": "gastroenterologia", "reason": "Si los síntomas son principalmente digestivos"},
                {"specialty_slug": "neurologia", "reason": "Si hay dolores de cabeza o síntomas neurológicos"}
            ],
            "red_flags_detected": [],
            "disclaimer": "Esto es solo una orientación basada en la información proporcionada. No reemplaza una consulta médica profesional. Si los síntomas empeoran o aparecen nuevos síntomas, acude a urgencias."
        }
    
    def _get_fallback_response(self) -> dict:
        return {
            "urgency": "medium",
            "recommended_specialty_slug": "medicina-interna",
            "rationale_bullets": [
                "Recomendamos una consulta con medicina interna como punto de partida",
                "El especialista evaluará tus síntomas y te orientará",
                "Es importante que un profesional revise tu caso"
            ],
            "clarifying_questions": [
                "¿Cuánto tiempo llevas con estos síntomas?",
                "¿Los síntomas han empeorado recientemente?"
            ],
            "alternatives": [],
            "red_flags_detected": [],
            "disclaimer": "Esto es solo una orientación. No reemplaza una consulta médica profesional. Si los síntomas empeoran, acude a urgencias."
        }


llm_client = LLMClient()
