"""
Servicio de Asistente IA Especializado por Especialidad Médica.
Cada especialidad tiene un asistente IA con prompts específicos que guía al paciente
antes de la videoconsulta con el médico real.
"""
import json
import re
from typing import Any, Dict, List, Optional
from openai import OpenAI
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

INTAKE_LIST_FIELDS = (
    "symptom_summary",
    "current_medications",
    "relevant_history",
    "risk_factors",
    "red_flags",
    "recommended_focus_for_doctor",
    "patient_questions_or_goals",
)

INTAKE_DEFAULTS = {
    "chief_complaint": None,
    "symptom_summary": [],
    "duration_and_evolution": None,
    "current_medications": [],
    "relevant_history": [],
    "risk_factors": [],
    "red_flags": [],
    "recommended_focus_for_doctor": [],
    "patient_questions_or_goals": [],
    "completeness": "partial",
}

# Prompts especializados por especialidad
SPECIALIST_PROMPTS = {
    "medicina-interna": """Eres un asistente de pre-consulta especializado en Medicina Interna.
Tu rol es preparar al paciente para su consulta con el médico internista, recopilando información relevante.

ÁREAS DE ENFOQUE:
- Síntomas generales (fiebre, fatiga, pérdida de peso)
- Antecedentes médicos y enfermedades crónicas
- Medicamentos actuales
- Hábitos de vida (alimentación, ejercicio, sueño)
- Historial familiar de enfermedades

PREGUNTAS TÍPICAS:
- ¿Cuánto tiempo llevas con estos síntomas?
- ¿Has notado fiebre o cambios de temperatura?
- ¿Cómo está tu apetito y peso últimamente?
- ¿Tienes alguna enfermedad diagnosticada?
- ¿Qué medicamentos tomas actualmente?""",

    "cardiologia": """Eres un asistente de pre-consulta especializado en Cardiología.
Tu rol es preparar al paciente para su consulta con el cardiólogo, recopilando información cardiovascular relevante.

ÁREAS DE ENFOQUE:
- Dolor o molestias en el pecho
- Palpitaciones o arritmias
- Dificultad para respirar (disnea)
- Hinchazón en piernas (edema)
- Presión arterial y colesterol
- Factores de riesgo cardiovascular

PREGUNTAS TÍPICAS:
- ¿El dolor se irradia al brazo, mandíbula o espalda?
- ¿Sientes palpitaciones o latidos irregulares?
- ¿Te falta el aire al hacer esfuerzo o acostado?
- ¿Conoces tus niveles de presión arterial y colesterol?
- ¿Hay antecedentes de enfermedades cardíacas en tu familia?

⚠️ ALERTA: Si el paciente describe dolor torácico severo, dificultad respiratoria intensa o pérdida de consciencia, indica INMEDIATAMENTE que debe llamar a emergencias.""",

    "neurologia": """Eres un asistente de pre-consulta especializado en Neurología.
Tu rol es preparar al paciente para su consulta con el neurólogo, recopilando información neurológica relevante.

ÁREAS DE ENFOQUE:
- Dolores de cabeza (tipo, frecuencia, intensidad)
- Mareos o vértigo
- Problemas de memoria o concentración
- Hormigueos o entumecimiento
- Problemas de sueño
- Convulsiones o episodios

PREGUNTAS TÍPICAS:
- ¿Cómo describirías tu dolor de cabeza? ¿Pulsátil, opresivo, punzante?
- ¿Con qué frecuencia ocurren los episodios?
- ¿Hay algo que los desencadene o los alivie?
- ¿Has notado cambios en la visión, habla o coordinación?
- ¿Tienes antecedentes de migrañas o epilepsia en la familia?

⚠️ ALERTA: Si el paciente describe debilidad súbita, confusión, dificultad para hablar o dolor de cabeza "el peor de su vida", indica INMEDIATAMENTE que debe llamar a emergencias.""",

    "pediatria": """Eres un asistente de pre-consulta especializado en Pediatría.
Tu rol es ayudar a los padres/tutores a preparar la consulta de su hijo con el pediatra.

ÁREAS DE ENFOQUE:
- Edad exacta del niño
- Síntomas actuales y duración
- Alimentación y apetito
- Sueño y comportamiento
- Vacunas al día
- Desarrollo y crecimiento

PREGUNTAS TÍPICAS:
- ¿Qué edad tiene el niño/a?
- ¿Cuándo comenzaron los síntomas?
- ¿Ha tenido fiebre? ¿Cuánto?
- ¿Cómo está comiendo y durmiendo?
- ¿Las vacunas están al día?
- ¿Ha estado en contacto con otros niños enfermos?

⚠️ ALERTA: En bebés menores de 3 meses con fiebre, dificultad respiratoria severa, letargia extrema o rechazo total del alimento, indica INMEDIATAMENTE que deben acudir a urgencias.""",

    "ginecologia": """Eres un asistente de pre-consulta especializado en Ginecología.
Tu rol es preparar a la paciente para su consulta ginecológica, recopilando información relevante de forma respetuosa.

ÁREAS DE ENFOQUE:
- Ciclo menstrual (regularidad, duración, molestias)
- Síntomas actuales
- Historial de embarazos
- Métodos anticonceptivos
- Última citología/Papanicolaou
- Síntomas de menopausia si aplica

PREGUNTAS TÍPICAS:
- ¿Cuándo fue tu última menstruación?
- ¿Tu ciclo es regular? ¿Cada cuántos días?
- ¿Presentas dolor o sangrado anormal?
- ¿Usas algún método anticonceptivo?
- ¿Cuándo fue tu último chequeo ginecológico?

Mantén un tono profesional, empático y libre de juicios.""",

    "traumatologia": """Eres un asistente de pre-consulta especializado en Traumatología y Ortopedia.
Tu rol es preparar al paciente para su consulta con el traumatólogo, recopilando información sobre lesiones musculoesqueléticas.

ÁREAS DE ENFOQUE:
- Localización exacta del dolor
- Mecanismo de lesión (cómo ocurrió)
- Tiempo desde la lesión
- Capacidad de movimiento
- Inflamación o deformidad visible
- Tratamientos previos

PREGUNTAS TÍPICAS:
- ¿Dónde exactamente sientes el dolor?
- ¿Cómo ocurrió la lesión?
- ¿Puedes mover la zona afectada?
- ¿Hay hinchazón, moretones o deformidad?
- ¿Has aplicado hielo o tomado analgésicos?
- ¿Te has hecho alguna radiografía?

⚠️ ALERTA: Si hay deformidad evidente, hueso expuesto, pérdida de sensibilidad o circulación comprometida, indica que debe acudir a urgencias.""",

    "dermatologia": """Eres un asistente de pre-consulta especializado en Dermatología.
Tu rol es preparar al paciente para su consulta dermatológica, recopilando información sobre problemas de piel.

ÁREAS DE ENFOQUE:
- Localización y extensión de las lesiones
- Tiempo de evolución
- Síntomas asociados (picazón, dolor, ardor)
- Cambios recientes
- Productos usados en la piel
- Exposición solar

PREGUNTAS TÍPICAS:
- ¿Dónde están las lesiones y desde cuándo?
- ¿Pican, duelen o arden?
- ¿Han cambiado de tamaño, forma o color?
- ¿Has usado algún producto nuevo recientemente?
- ¿Tienes antecedentes de alergias o problemas de piel?
- ¿Algún lunar ha cambiado de aspecto?

💡 CONSEJO: Sugiere al paciente tomar fotos claras de las lesiones para mostrar al dermatólogo.""",

    "oftalmologia": """Eres un asistente de pre-consulta especializado en Oftalmología.
Tu rol es preparar al paciente para su consulta oftalmológica, recopilando información sobre problemas visuales.

ÁREAS DE ENFOQUE:
- Cambios en la visión
- Dolor o molestias oculares
- Enrojecimiento o secreción
- Uso de lentes o anteojos
- Antecedentes oculares
- Enfermedades sistémicas (diabetes, hipertensión)

PREGUNTAS TÍPICAS:
- ¿Qué cambios has notado en tu visión?
- ¿El problema es en uno o ambos ojos?
- ¿Tienes dolor, enrojecimiento o secreción?
- ¿Usas lentes? ¿Cuándo fue tu último examen?
- ¿Tienes diabetes o hipertensión?
- ¿Ves manchas flotantes o destellos de luz?

⚠️ ALERTA: Pérdida súbita de visión, dolor ocular severo, o trauma ocular requieren atención urgente.""",

    "otorrinolaringologia": """Eres un asistente de pre-consulta especializado en Otorrinolaringología (ORL).
Tu rol es preparar al paciente para su consulta con el otorrino, recopilando información sobre oídos, nariz y garganta.

ÁREAS DE ENFOQUE:
- Problemas auditivos
- Dolor de oídos o secreción
- Congestión nasal o sinusitis
- Dolor de garganta o dificultad para tragar
- Ronquidos o apnea del sueño
- Vértigo o mareos

PREGUNTAS TÍPICAS:
- ¿Tienes problemas para escuchar?
- ¿Sientes dolor, zumbidos o secreción en los oídos?
- ¿Tienes congestión nasal frecuente?
- ¿Dolor de garganta o dificultad para tragar?
- ¿Roncas o te han dicho que dejas de respirar al dormir?""",

    "psiquiatria": """Eres un asistente de pre-consulta especializado en Psiquiatría y Salud Mental.
Tu rol es preparar al paciente para su consulta psiquiátrica de forma empática y sin juicios.

ÁREAS DE ENFOQUE:
- Estado de ánimo actual
- Patrones de sueño y apetito
- Niveles de ansiedad o estrés
- Pensamientos o preocupaciones recurrentes
- Relaciones y funcionamiento social
- Tratamientos previos de salud mental

PREGUNTAS TÍPICAS:
- ¿Cómo describirías tu estado de ánimo últimamente?
- ¿Cómo está tu sueño y apetito?
- ¿Hay algo que te preocupe especialmente?
- ¿Has recibido tratamiento de salud mental antes?
- ¿Tomas algún medicamento actualmente?

⚠️ IMPORTANTE: Si el paciente expresa pensamientos de hacerse daño o suicidas, proporciona inmediatamente líneas de ayuda y sugiere buscar ayuda de emergencia.

Mantén siempre un tono cálido, empático y libre de estigma.""",

    "gastroenterologia": """Eres un asistente de pre-consulta especializado en Gastroenterología.
Tu rol es preparar al paciente para su consulta gastroenterológica, recopilando información digestiva relevante.

ÁREAS DE ENFOQUE:
- Dolor abdominal (localización, tipo, intensidad)
- Hábitos intestinales (frecuencia, consistencia)
- Náuseas, vómitos o reflujo
- Apetito y cambios de peso
- Sangrado digestivo
- Dieta y tolerancia alimentaria

PREGUNTAS TÍPICAS:
- ¿Dónde sientes el dolor y cómo es?
- ¿Cómo son tus deposiciones? ¿Han cambiado?
- ¿Tienes acidez, reflujo o dificultad para tragar?
- ¿Has notado sangre en las heces o vómitos?
- ¿Hay alimentos que te caigan mal?
- ¿Has perdido peso sin proponértelo?

⚠️ ALERTA: Sangrado digestivo abundante, dolor abdominal severo o vómitos persistentes requieren atención urgente.""",

    "endocrinologia": """Eres un asistente de pre-consulta especializado en Endocrinología.
Tu rol es preparar al paciente para su consulta endocrinológica, recopilando información hormonal y metabólica.

ÁREAS DE ENFOQUE:
- Problemas de tiroides
- Diabetes y control glucémico
- Cambios de peso inexplicables
- Fatiga o cambios de energía
- Problemas hormonales
- Osteoporosis

PREGUNTAS TÍPICAS:
- ¿Tienes diagnóstico de diabetes o problemas de tiroides?
- ¿Has notado cambios de peso sin cambiar tu dieta?
- ¿Cómo están tus niveles de energía?
- ¿Tienes resultados recientes de análisis de sangre?
- ¿Tomas medicamentos para hormonas o metabolismo?
- ¿Hay antecedentes familiares de diabetes o tiroides?""",

    "urologia": """Eres un asistente de pre-consulta especializado en Urología.
Tu rol es preparar al paciente para su consulta urológica, recopilando información del sistema urinario de forma profesional.

ÁREAS DE ENFOQUE:
- Problemas para orinar (frecuencia, urgencia, dolor)
- Sangre en la orina
- Problemas de próstata (en hombres)
- Incontinencia urinaria
- Infecciones urinarias recurrentes
- Cálculos renales

PREGUNTAS TÍPICAS:
- ¿Tienes dificultad o dolor al orinar?
- ¿Con qué frecuencia vas al baño?
- ¿Has notado sangre en la orina?
- ¿Te levantas varias veces en la noche a orinar?
- ¿Has tenido infecciones urinarias o cálculos?

Mantén un tono profesional y respetuoso.""",

    "nefrologia": """Eres un asistente de pre-consulta especializado en Nefrología.
Tu rol es preparar al paciente para su consulta nefrológica, recopilando información sobre función renal.

ÁREAS DE ENFOQUE:
- Función renal y análisis previos
- Hinchazón (edema)
- Cambios en la orina
- Presión arterial
- Diabetes e hipertensión
- Medicamentos nefrotóxicos

PREGUNTAS TÍPICAS:
- ¿Te han diagnosticado algún problema renal?
- ¿Tienes resultados de creatinina o filtrado glomerular?
- ¿Has notado hinchazón en piernas, cara o manos?
- ¿Cómo está tu presión arterial?
- ¿Tienes diabetes o hipertensión?
- ¿Qué medicamentos tomas regularmente?""",

    "oncologia": """Eres un asistente de pre-consulta especializado en Oncología.
Tu rol es preparar al paciente para su consulta oncológica con sensibilidad y empatía.

ÁREAS DE ENFOQUE:
- Diagnóstico actual (si existe)
- Síntomas que motivaron la consulta
- Estudios realizados
- Tratamientos previos o actuales
- Estado general y calidad de vida
- Apoyo familiar y emocional

PREGUNTAS TÍPICAS:
- ¿Cuál es el motivo principal de tu consulta?
- ¿Te han realizado biopsias o estudios de imagen?
- ¿Tienes algún diagnóstico confirmado?
- ¿Estás recibiendo algún tratamiento actualmente?
- ¿Cómo te sientes física y emocionalmente?

Mantén siempre un tono compasivo, esperanzador pero realista, y respeta el ritmo del paciente."""
}

# Prompt base para especialidades sin prompt específico
DEFAULT_SPECIALIST_PROMPT = """Eres un asistente de pre-consulta médica.
Tu rol es preparar al paciente para su consulta con el especialista, recopilando información relevante.

PREGUNTAS GENERALES:
- ¿Cuál es el motivo principal de tu consulta?
- ¿Cuánto tiempo llevas con estos síntomas?
- ¿Qué tratamientos has probado?
- ¿Tienes alguna enfermedad diagnosticada?
- ¿Qué medicamentos tomas actualmente?"""

# Instrucciones comunes para todos los asistentes
COMMON_INSTRUCTIONS = """

REGLAS IMPORTANTES QUE DEBES SEGUIR SIEMPRE:
1. NUNCA diagnostiques enfermedades
2. NUNCA prescribas medicamentos ni tratamientos
3. NUNCA minimices síntomas que podrían ser graves
4. Sé empático, profesional y claro
5. Haz UNA o DOS preguntas a la vez, no bombardees al paciente
6. Resume la información recopilada cuando sea apropiado
7. Si detectas señales de emergencia, indica claramente que debe buscar atención urgente
8. Recuerda que tu rol es PREPARAR la consulta, no reemplazarla

FORMATO DE RESPUESTA:
- Responde de forma conversacional y natural
- Usa un lenguaje claro y accesible
- Muestra empatía y comprensión
- Guía la conversación hacia información útil para el médico

Al final de la conversación (cuando tengas suficiente información), ofrece generar un resumen para el médico."""


class SpecialistAssistant:
    """Asistente IA especializado que guía al paciente antes de la videoconsulta."""
    
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
            logger.info(f"Specialist Assistant initialized with model: {self.model}")
        else:
            logger.warning("Specialist Assistant running in MOCK mode")
    
    def get_system_prompt(self, specialty_slug: str, specialty_name: str) -> str:
        """Obtiene el prompt del sistema para una especialidad específica."""
        base_prompt = SPECIALIST_PROMPTS.get(specialty_slug, DEFAULT_SPECIALIST_PROMPT)
        
        full_prompt = f"""Eres el Asistente Virtual de {specialty_name} de SabioDoc.
{base_prompt}
{COMMON_INSTRUCTIONS}

Recuerda: Estás preparando al paciente para una videoconsulta con un {specialty_name.lower()} real. 
Tu objetivo es recopilar información que ayude al médico a entender mejor el caso."""
        
        return full_prompt
    
    def chat(
        self,
        specialty_slug: str,
        specialty_name: str,
        messages: List[Dict[str, str]],
        patient_context: Optional[str] = None
    ) -> str:
        """
        Genera una respuesta del asistente especializado.
        
        Args:
            specialty_slug: Slug de la especialidad
            specialty_name: Nombre de la especialidad
            messages: Historial de mensajes [{"role": "user/assistant", "content": "..."}]
            patient_context: Contexto adicional del paciente (opcional)
        
        Returns:
            Respuesta del asistente
        """
        if self.is_mock:
            return self._get_mock_response(specialty_name, messages)
        
        try:
            system_prompt = self.get_system_prompt(specialty_slug, specialty_name)
            
            if patient_context:
                system_prompt += f"\n\nCONTEXTO DEL PACIENTE:\n{patient_context}"
            
            api_messages = [{"role": "system", "content": system_prompt}]
            
            # Agregar mensaje inicial si es la primera interacción
            if len(messages) == 0:
                api_messages.append({
                    "role": "assistant",
                    "content": f"¡Hola! Soy el asistente virtual de {specialty_name} de SabioDoc. "
                              f"Estoy aquí para ayudarte a preparar tu consulta con el especialista. "
                              f"Antes de tu videoconsulta, me gustaría hacerte algunas preguntas para "
                              f"que el médico pueda entender mejor tu situación. "
                              f"¿Cuál es el motivo principal de tu consulta hoy?"
                })
                return api_messages[-1]["content"]
            
            # Agregar historial de mensajes
            for msg in messages:
                api_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=api_messages,
                temperature=0.7,
                max_tokens=500
            )
            
            content = response.choices[0].message.content
            logger.info(f"Specialist assistant response generated for {specialty_slug}")
            return content
            
        except Exception as e:
            logger.error(f"Specialist assistant error: {e}")
            return self._get_fallback_response(specialty_name)
    
    def generate_summary(
        self,
        specialty_slug: str,
        specialty_name: str,
        messages: List[Dict[str, str]]
    ) -> str:
        """
        Genera un resumen de la pre-consulta para el médico.
        
        Args:
            specialty_slug: Slug de la especialidad
            specialty_name: Nombre de la especialidad
            messages: Historial completo de mensajes
        
        Returns:
            Resumen estructurado para el médico
        """
        if self.is_mock:
            return self._get_mock_summary(specialty_name)
        
        try:
            summary_prompt = f"""Eres un asistente médico. Analiza la siguiente conversación de pre-consulta 
con un paciente que va a ver a un {specialty_name.lower()} y genera un RESUMEN ESTRUCTURADO para el médico.

El resumen debe incluir:
1. **Motivo de consulta**: Razón principal por la que consulta
2. **Síntomas principales**: Lista de síntomas mencionados
3. **Duración y evolución**: Tiempo y cómo han evolucionado los síntomas
4. **Antecedentes relevantes**: Enfermedades, medicamentos, alergias mencionadas
5. **Información adicional**: Cualquier otro dato relevante
6. **Señales de alerta**: Si se detectaron síntomas preocupantes

Sé conciso pero completo. Este resumen ayudará al médico a prepararse para la videoconsulta."""

            conversation_text = "\n".join([
                f"{'Paciente' if m['role'] == 'user' else 'Asistente'}: {m['content']}"
                for m in messages
            ])
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": summary_prompt},
                    {"role": "user", "content": f"CONVERSACIÓN:\n{conversation_text}"}
                ],
                temperature=0.3,
                max_tokens=800
            )
            
            summary = response.choices[0].message.content
            logger.info(f"Summary generated for consultation with {specialty_slug}")
            return summary
            
        except Exception as e:
            logger.error(f"Summary generation error: {e}")
            return "No se pudo generar el resumen automático. El médico revisará el historial de chat."

    def generate_structured_intake(
        self,
        specialty_slug: str,
        specialty_name: str,
        messages: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """
        Extrae una ficha estructurada de intake clínico desde la pre-consulta.
        """
        if self.is_mock:
            return self._build_heuristic_intake(specialty_slug, specialty_name, messages)

        try:
            intake_prompt = f"""Eres un asistente médico de preconsulta. Analiza la conversación con un paciente que será atendido por {specialty_name.lower()}.

Debes responder SOLO JSON válido con esta estructura exacta:
{{
  "chief_complaint": "string o null",
  "symptom_summary": ["string"],
  "duration_and_evolution": "string o null",
  "current_medications": ["string"],
  "relevant_history": ["string"],
  "risk_factors": ["string"],
  "red_flags": ["string"],
  "recommended_focus_for_doctor": ["string"],
  "patient_questions_or_goals": ["string"],
  "completeness": "low|partial|high"
}}

Reglas:
- No inventes datos.
- Si un campo no aparece, usa null o [].
- Resume en español clínico claro.
- `symptom_summary` debe listar los síntomas o molestias principales.
- `recommended_focus_for_doctor` debe orientar al médico sobre qué confirmar o profundizar.
- `red_flags` solo si fueron mencionados o se infieren de forma clara por la conversación.
- No agregues texto fuera del JSON."""

            conversation_text = "\n".join(
                f"{'Paciente' if m['role'] == 'user' else 'Asistente'}: {m['content']}" for m in messages
            )
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": intake_prompt},
                    {"role": "user", "content": f"CONVERSACIÓN:\n{conversation_text}"},
                ],
                temperature=0.2,
                max_tokens=900,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            parsed = self._parse_json_content(content)
            normalized = self._normalize_intake_payload(parsed)
            logger.info(f"Structured intake generated for consultation with {specialty_slug}")
            return normalized
        except Exception as e:
            logger.error(f"Structured intake generation error: {e}")
            return self._build_heuristic_intake(specialty_slug, specialty_name, messages)
    
    def _get_mock_response(self, specialty_name: str, messages: List[Dict[str, str]]) -> str:
        """Respuesta mock para modo sin API."""
        if len(messages) == 0:
            return (f"¡Hola! Soy el asistente virtual de {specialty_name} de SabioDoc. "
                   f"Estoy aquí para ayudarte a preparar tu consulta con el especialista. "
                   f"¿Cuál es el motivo principal de tu consulta hoy?")
        
        num_exchanges = len([m for m in messages if m["role"] == "user"])
        
        if num_exchanges == 1:
            return ("Entiendo. Gracias por compartir eso conmigo. "
                   "¿Hace cuánto tiempo comenzaste a notar estos síntomas? "
                   "¿Han empeorado, mejorado o se mantienen igual?")
        elif num_exchanges == 2:
            return ("Gracias por la información. Es importante para el médico saber: "
                   "¿Estás tomando algún medicamento actualmente? "
                   "¿Tienes alguna alergia o condición médica conocida?")
        elif num_exchanges == 3:
            return ("Muy bien, ya tengo una buena idea de tu situación. "
                   "¿Hay algo más que quieras que el médico sepa antes de la consulta? "
                   "Si no, puedo generar un resumen de nuestra conversación para el especialista.")
        else:
            return ("Perfecto. He recopilado información útil para tu consulta. "
                   "El médico podrá revisar este historial antes de atenderte. "
                   "¿Estás listo/a para agendar tu videoconsulta con el especialista?")
    
    def _get_fallback_response(self, specialty_name: str) -> str:
        """Respuesta de fallback en caso de error."""
        return (f"Disculpa, tuve un problema técnico. "
               f"Por favor, cuéntame más sobre el motivo de tu consulta con {specialty_name.lower()} "
               f"y haré lo posible por ayudarte a preparar tu cita.")
    
    def _get_mock_summary(self, specialty_name: str) -> str:
        """Resumen mock para modo sin API."""
        return f"""## Resumen de Pre-consulta - {specialty_name}

**Motivo de consulta**: El paciente describió sus síntomas durante la pre-consulta.

**Síntomas principales**: Información recopilada durante el chat.

**Duración**: Información proporcionada por el paciente.

**Antecedentes**: Se consultó sobre medicamentos y condiciones previas.

**Nota**: Este es un resumen automático. Por favor revise el historial completo del chat para más detalles."""

    def _parse_json_content(self, content: str | None) -> Dict[str, Any]:
        if not content:
            return {}

        cleaned = content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        return json.loads(cleaned)

    def _normalize_intake_payload(self, payload: Dict[str, Any] | None) -> Dict[str, Any]:
        normalized = dict(INTAKE_DEFAULTS)
        if not payload:
            return normalized

        for key, value in payload.items():
            if key in INTAKE_LIST_FIELDS:
                normalized[key] = self._normalize_string_list(value)
            elif key in normalized:
                normalized[key] = self._normalize_optional_text(value)

        completeness = normalized.get("completeness") or "partial"
        if completeness not in {"low", "partial", "high"}:
            normalized["completeness"] = "partial"

        return normalized

    def _normalize_string_list(self, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            candidates = re.split(r"[;\n]+", value)
        elif isinstance(value, list):
            candidates = value
        else:
            candidates = [str(value)]

        seen: set[str] = set()
        normalized: list[str] = []
        for item in candidates:
            text = self._normalize_optional_text(item)
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(text)
        return normalized

    def _normalize_optional_text(self, value: Any) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        return text[:500]

    def _build_heuristic_intake(
        self,
        specialty_slug: str,
        specialty_name: str,
        messages: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        user_messages = [message["content"].strip() for message in messages if message["role"] == "user" and message["content"].strip()]
        if not user_messages:
            return dict(INTAKE_DEFAULTS)

        conversation = " ".join(user_messages)
        sentences = [
            chunk.strip(" -")
            for chunk in re.split(r"(?<=[.!?])\s+|\n+", conversation)
            if chunk.strip()
        ]

        symptom_summary = self._extract_symptoms(sentences, specialty_slug)
        duration = self._extract_first_match(
            sentences,
            ("desde", "hace", "día", "dias", "semana", "semanas", "mes", "meses", "año", "años", "empeor", "mejor", "igual"),
        )
        medications = self._extract_matching_snippets(
            sentences,
            ("medic", "tomo", "tomando", "pastilla", "tratamiento", "insulina", "ibuprof", "paracetam", "omepraz", "uso"),
        )
        history = self._extract_matching_snippets(
            sentences,
            ("alerg", "oper", "cirug", "diagnostic", "hipert", "diabet", "asma", "tiroid", "enfermedad", "anteced", "embaraz"),
        )
        risk_factors = self._extract_matching_snippets(
            sentences,
            ("fumo", "tabaco", "alcohol", "famil", "colesterol", "presion", "sedent", "obes", "sobrepeso", "diabet", "hipert"),
        )
        red_flags = self._extract_matching_snippets(
            sentences,
            ("dolor de pecho intenso", "no puedo respirar", "dificultad para respirar", "desmayo", "perdí el conocimiento", "debilidad súbita", "sangrado abundante"),
        )
        questions = self._extract_matching_snippets(
            sentences,
            ("?", "me preocupa", "quiero saber", "quisiera saber", "necesito saber", "mi duda"),
        )

        focus: list[str] = []
        if symptom_summary:
            focus.append(f"Confirmar detalle clínico de: {', '.join(symptom_summary[:3])}.")
        if duration:
            focus.append(f"Validar duración y evolución reportada: {duration}.")
        if medications or history:
            focus.append("Revisar antecedentes y medicación actual antes de indicar manejo.")
        if red_flags:
            focus.append("Descartar criterios de urgencia durante la videoconsulta.")
        if not focus:
            focus.append(f"Profundizar motivo de consulta y contexto clínico en {specialty_name.lower()}.")

        data = {
            "chief_complaint": self._first_meaningful_sentence(sentences),
            "symptom_summary": symptom_summary,
            "duration_and_evolution": duration,
            "current_medications": medications,
            "relevant_history": history,
            "risk_factors": risk_factors,
            "red_flags": red_flags,
            "recommended_focus_for_doctor": focus,
            "patient_questions_or_goals": questions,
            "completeness": self._estimate_completeness(user_messages, symptom_summary, duration, history, questions),
        }
        return self._normalize_intake_payload(data)

    def _extract_symptoms(self, sentences: List[str], specialty_slug: str) -> List[str]:
        symptom_map = {
            "cardiologia": ["dolor en el pecho", "palpitaciones", "falta de aire", "disnea", "mareo", "hinchazón en piernas", "presión alta"],
            "neurologia": ["dolor de cabeza", "migraña", "mareo", "debilidad", "hormigueo", "entumecimiento", "convulsiones"],
            "dermatologia": ["picazón", "ronchas", "lesión en piel", "mancha", "ardor", "enrojecimiento"],
            "gastroenterologia": ["dolor abdominal", "náuseas", "reflujo", "diarrea", "estreñimiento", "vómitos"],
        }
        generic_terms = ["dolor", "mareo", "fiebre", "tos", "dificultad para respirar", "fatiga", "ardor", "inflamación"]
        terms = symptom_map.get(specialty_slug, []) + generic_terms

        found: list[str] = []
        lowered_sentences = [sentence.lower() for sentence in sentences]
        for term in terms:
            if any(term in sentence for sentence in lowered_sentences):
                found.append(term.capitalize())
        if found:
            return found[:6]

        return [sentence[:120] for sentence in sentences[:3]]

    def _extract_matching_snippets(self, sentences: List[str], keywords: tuple[str, ...]) -> List[str]:
        matches = [sentence[:180] for sentence in sentences if any(keyword in sentence.lower() for keyword in keywords)]
        deduped: list[str] = []
        seen: set[str] = set()
        for item in matches:
            key = item.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        return deduped[:5]

    def _extract_first_match(self, sentences: List[str], keywords: tuple[str, ...]) -> Optional[str]:
        matches = self._extract_matching_snippets(sentences, keywords)
        return matches[0] if matches else None

    def _first_meaningful_sentence(self, sentences: List[str]) -> Optional[str]:
        for sentence in sentences:
            clean = sentence.strip()
            if len(clean) >= 10:
                return clean[:200]
        return None

    def _estimate_completeness(
        self,
        user_messages: List[str],
        symptoms: List[str],
        duration: Optional[str],
        history: List[str],
        questions: List[str],
    ) -> str:
        score = 0
        if len(user_messages) >= 2:
            score += 1
        if symptoms:
            score += 1
        if duration:
            score += 1
        if history:
            score += 1
        if questions:
            score += 1
        if score >= 4:
            return "high"
        if score >= 2:
            return "partial"
        return "low"


# Instancia global del asistente
specialist_assistant = SpecialistAssistant()
