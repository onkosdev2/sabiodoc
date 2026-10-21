import LegalPage, { LegalSection } from '../components/LegalPage'
import { LEGAL_STATUS, LEGAL_UPDATED, LEGAL_VERSION } from '../utils/legal'

const SECTIONS: LegalSection[] = [
  {
    heading: 'Naturaleza del servicio',
    paragraphs: [
      'SabioDoc es una plataforma de orientación médica y de conexión con profesionales de la salud. No es un servicio de emergencias y no sustituye una consulta médica presencial cuando esta sea necesaria. Ante una urgencia, acude a los servicios de emergencia de tu país.',
    ],
  },
  {
    heading: 'Cuenta y uso adecuado',
    bullets: [
      'Debes ser mayor de edad y proporcionar información veraz.',
      'Eres responsable de mantener la confidencialidad de tu contraseña y de la actividad de tu cuenta.',
      'No está permitido usar la plataforma para fines ilícitos, suplantar identidades ni acosar a otros usuarios.',
    ],
  },
  {
    heading: 'Profesionales de la salud',
    paragraphs: [
      'Los médicos son responsables de la atención clínica que brindan y de la veracidad de sus credenciales. SabioDoc verifica la documentación declarada, pero no garantiza resultados clínicos ni la disponibilidad permanente de un profesional.',
    ],
  },
  {
    heading: 'Pagos, créditos y comisión',
    bullets: [
      'Las videoconsultas se pagan con créditos (1 crédito = 1 USD). Actualmente los créditos son de prueba.',
      'Al agendar se retiene un importe; al finalizar se cobra solo el tiempo real y se reembolsa lo no usado.',
      'La plataforma aplica una comisión sobre lo que cobra el médico, que se muestra en su panel.',
      'Los retiros de médicos se procesan según el método de pago disponible.',
    ],
  },
  {
    heading: 'Cancelaciones y reembolsos',
    paragraphs: [
      'Si una cita se cancela, el importe retenido se devuelve al saldo del paciente. Si una videoconsulta no llega a realizarse por un fallo técnico, no se cobra: el importe retenido se reembolsa. Los detalles y plazos concretos se publicarán al activar pagos reales.',
    ],
  },
  {
    heading: 'Limitación de responsabilidad',
    paragraphs: [
      'La información de la plataforma es orientativa. En la máxima medida permitida por la ley, SabioDoc no se responsabiliza de decisiones tomadas sin la valoración de un profesional ni de interrupciones por causas ajenas a su control.',
    ],
  },
  {
    heading: 'Propiedad intelectual',
    paragraphs: [
      'El contenido, la marca y el software de SabioDoc están protegidos. No puedes copiarlos, modificarlos ni redistribuirlos sin autorización.',
    ],
  },
  {
    heading: 'Ley aplicable y cambios',
    paragraphs: [
      'Estos términos se rigen por la legislación del país donde opera el responsable, sin perjuicio de los derechos que te correspondan como consumidor. Podemos actualizarlos; publicaremos la versión vigente con su fecha.',
    ],
  },
]

export default function Terms() {
  return (
    <LegalPage
      title="Términos y condiciones"
      description="Reglas de uso de SabioDoc."
      updated={LEGAL_UPDATED}
      version={LEGAL_VERSION}
      status={LEGAL_STATUS}
      intro={
        <p>
          Al crear una cuenta o usar SabioDoc aceptas estos términos. Léelos con atención.
        </p>
      }
      sections={SECTIONS}
    />
  )
}
