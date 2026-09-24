import json
import time
from concurrent.futures import ThreadPoolExecutor
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
        self.timeout = settings.LLM_TIMEOUT_SECONDS
        self.providers: list[tuple[str, OpenAI, str]] = []

        if settings.DEEPSEEK_API_KEY:
            deepseek_base = settings.DEEPSEEK_BASE_URL
            if not deepseek_base.endswith("/v1"):
                deepseek_base = f"{deepseek_base}/v1"
            self.providers.append(
                (
                    "deepseek",
                    OpenAI(
                        api_key=settings.DEEPSEEK_API_KEY,
                        base_url=deepseek_base,
                        timeout=self.timeout,
                        max_retries=0,
                    ),
                    settings.DEEPSEEK_MODEL,
                )
            )

        if settings.GROQ_API_KEY:
            self.providers.append(
                (
                    "groq",
                    OpenAI(
                        api_key=settings.GROQ_API_KEY,
                        base_url=settings.GROQ_BASE_URL,
                        timeout=self.timeout,
                        max_retries=0,
                    ),
                    settings.GROQ_MODEL,
                )
            )

        self.is_mock = not self.providers

        if self.is_mock:
            logger.warning("LLM Client running in MOCK mode - no API key configured")
        else:
            logger.info(
                "LLM Client initialized with providers: %s (timeout=%ss)",
                " -> ".join(name for name, _, _ in self.providers),
                self.timeout,
            )

    def _try_providers(
        self,
        *,
        messages: list[dict],
        temperature: float,
        max_tokens: int,
        json_mode: bool,
        parse,
    ):
        """Ejecuta la peticion en orden de prioridad.

        Si un proveedor falla, no responde o excede el timeout, se pasa al
        siguiente (p. ej. DeepSeek -> Groq). Devuelve el resultado ya parseado
        o ``None`` si todos fallan.
        """
        for index, (name, client, model) in enumerate(self.providers):
            try:
                params: dict = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "timeout": self.timeout,
                }
                if json_mode:
                    params["response_format"] = {"type": "json_object"}

                response = client.chat.completions.create(**params)
                content = response.choices[0].message.content or ""
                result = parse(content)
                logger.info(f"LLM response OK from provider={name}")
                return result
            except Exception as e:  # noqa: BLE001 - queremos capturar todo para el fallback
                next_provider = self.providers[index + 1][0] if index + 1 < len(self.providers) else None
                if next_provider:
                    logger.warning(f"LLM provider '{name}' failed ({e}); falling back to '{next_provider}'")
                else:
                    logger.error(f"LLM provider '{name}' failed and no fallback available: {e}")
        return None

    def get_triage_response(
        self,
        symptoms_text: str,
        age: Optional[int] = None,
        sex: Optional[str] = None
    ) -> dict:
        if self.is_mock:
            return self._get_mock_response(symptoms_text)

        user_message = f"Síntomas del paciente: {symptoms_text}"
        if age:
            user_message += f"\nEdad: {age} años"
        if sex:
            sex_map = {"male": "masculino", "female": "femenino", "other": "otro"}
            user_message += f"\nSexo: {sex_map.get(sex, sex)}"

        result = self._try_providers(
            messages=[
                {"role": "system", "content": TRIAGE_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.3,
            max_tokens=1000,
            json_mode=True,
            parse=self._parse_json_content,
        )
        if not isinstance(result, dict):
            logger.error("Triage: todos los proveedores LLM fallaron o devolvieron JSON invalido")
            return self._get_fallback_response()

        logger.info(f"Triage completed: urgency={result.get('urgency')}")
        return result

    def chat_json(
        self,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.3,
        max_tokens: int = 1200,
    ) -> Optional[dict]:
        """Ejecuta una consulta al LLM forzando una respuesta JSON.

        Devuelve el dict parseado, o ``None`` si el cliente esta en modo mock
        o si todos los proveedores fallan.
        """
        if self.is_mock:
            return None

        result = self._try_providers(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=True,
            parse=self._parse_json_content,
        )
        return result if isinstance(result, dict) else None

    def health_check(self) -> dict:
        """Comprueba la disponibilidad de cada proveedor LLM (sin consumir tokens).

        Se consultan en paralelo para que el tiempo total sea el del proveedor más
        lento (no la suma), y así la petición no se eternice y Render/móvil no la
        corte antes de responder.
        """
        if self.is_mock or not self.providers:
            return {
                "healthy": True,
                "mode": "mock",
                "providers": [],
            }

        def _check(provider: tuple[str, OpenAI, str]) -> dict:
            name, client, model = provider
            started = time.perf_counter()
            try:
                client.models.list(timeout=self.timeout)
                return {
                    "name": name,
                    "model": model,
                    "status": "ok",
                    "latency_ms": round((time.perf_counter() - started) * 1000, 1),
                }
            except Exception as e:  # noqa: BLE001
                return {
                    "name": name,
                    "model": model,
                    "status": "error",
                    "latency_ms": round((time.perf_counter() - started) * 1000, 1),
                    "detail": str(e)[:200],
                }

        with ThreadPoolExecutor(max_workers=len(self.providers)) as executor:
            providers_status = list(executor.map(_check, self.providers))

        return {
            "healthy": any(item["status"] == "ok" for item in providers_status),
            "mode": "live",
            "providers": providers_status,
        }

    def chat_text(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 600,
    ) -> Optional[str]:
        """Chat conversacional (texto plano) con fallback de proveedores."""
        if self.is_mock:
            return None
        result = self._try_providers(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=False,
            parse=lambda content: content,
        )
        return result if result else None

    def _parse_json_content(self, content: str) -> dict:
        """Limpia los bloques de código Markdown y parsea el JSON."""
        cleaned = content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return json.loads(cleaned.strip())
    
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
