/**
 * Detección de síntomas de alarma.
 *
 * Es una lista de expresiones de "bandera roja" que, si aparecen en lo que
 * escribe el usuario, fuerzan a mostrar un aviso de urgencia y le redirigen a
 * emergencias o al flujo de triaje (con supervisión), en lugar de devolver una
 * especialidad por coincidencia léxica.
 *
 * No es un diagnóstico: es una salvaguarda para no silenciar una urgencia.
 */

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

interface AlarmRule {
  flag: string
  patterns: string[]
}

const ALARM_RULES: AlarmRule[] = [
  {
    flag: 'Dolor o presión en el pecho',
    patterns: [
      'dolor en el pecho',
      'dolor de pecho',
      'dolor toracico',
      'presion en el pecho',
      'presion toracica',
      'opresion en el pecho',
      'pecho apretado',
      'infarto',
      'paro cardiaco',
      'paro cardiorrespiratorio',
    ],
  },
  {
    flag: 'Dificultad para respirar',
    patterns: [
      'dificultad para respirar',
      'dificultad al respirar',
      'falta de aire',
      'no puedo respirar',
      'me falta el aire',
      'me ahogo',
      'asfixia',
      'disnea',
    ],
  },
  {
    flag: 'Signos neurológicos (posible derrame/ACV)',
    patterns: [
      'derrame cerebral',
      'derrame',
      'ictus',
      'acv',
      'debilidad en un lado',
      'no puedo mover',
      'no puedo hablar',
      'dificultad para hablar',
      'confusion repentina',
      'se me tuerce la boca',
      'convulsion',
      'convulsiones',
      'desmayo',
      'perdi el conocimiento',
      'inconsciente',
      'no responde',
    ],
  },
  {
    flag: 'Sangrado abundante',
    patterns: [
      'sangrado abundante',
      'hemorragia',
      'sangra mucho',
      'no se detiene el sangrado',
      'vomito sangre',
      'vomito con sangre',
      'sangre en las heces',
      'sangre en el vomito',
    ],
  },
  {
    flag: 'Reacción alérgica grave',
    patterns: [
      'anafilaxia',
      'alergia grave',
      'hinchazon de la cara',
      'hinchazon de labios',
      'labios hinchados',
      'garganta cerrada',
      'se me cierra la garganta',
    ],
  },
  {
    flag: 'Intoxicación o sobredosis',
    patterns: ['sobredosis', 'intoxicacion', 'envenenamiento', 'tome de mas', 'ingiri de mas'],
  },
  {
    flag: 'Riesgo para la propia vida',
    patterns: [
      'quiero morir',
      'me quiero matar',
      'quiero quitarme la vida',
      'pensamientos suicidas',
      'suicidio',
    ],
  },
  {
    flag: 'Embarazo con signos de alarma',
    patterns: [
      'sangrado vaginal embarazo',
      'embarazo sangrado',
      'dolor abdominal intenso embarazo',
      'no siento al bebe',
    ],
  },
]

/** Devuelve las banderas de alarma detectadas en un texto (puede estar vacío). */
export function detectAlarmSymptoms(text: string): string[] {
  if (!text || text.trim().length < 3) return []
  const normalized = normalize(text)
  const found: string[] = []
  for (const rule of ALARM_RULES) {
    if (rule.patterns.some((pattern) => normalized.includes(pattern))) {
      found.push(rule.flag)
    }
  }
  return found
}
