import LegalPage, { LegalSection } from '../components/LegalPage'
import { LEGAL_STATUS, LEGAL_UPDATED, LEGAL_VERSION } from '../utils/legal'

const SECTIONS: LegalSection[] = [
  {
    heading: 'Quién trata tus datos',
    paragraphs: [
      'SabioDoc (en adelante, "la plataforma") es el responsable del tratamiento de los datos personales que se recogen a través del sitio y la aplicación. Puedes contactar al responsable y ejercer tus derechos a través del canal de Ayuda y soporte de la plataforma.',
    ],
  },
  {
    heading: 'Qué datos tratamos',
    bullets: [
      'Datos de cuenta e identidad: correo, contraseña (cifrada), nombre y rol.',
      'Datos de salud: síntomas, motivos de consulta, resúmenes e indicaciones que compartes voluntariamente con la IA o con el médico.',
      'Datos de la cita y la videoconsulta: fecha, duración, estado, archivos compartidos y notas clínicas.',
      'Datos de pago: movimientos de créditos y referencias de pago (no almacenamos números de tarjeta).',
      'Datos técnicos: dirección IP, navegador, identificadores de sesión y registros de error para seguridad y soporte.',
      'Datos de profesionales de salud: licencia, registro, país, ciudad y documento de identidad para verificación.',
    ],
  },
  {
    heading: 'Para qué y con qué base legal',
    bullets: [
      'Prestar el servicio (orientación médica y videoconsultas): ejecución del contrato.',
      'Datos de salud: tu consentimiento explícito, otorgado antes de enviar síntomas o iniciar una consulta.',
      'Seguridad, prevención de fraude y soporte: interés legítimo y cumplimiento de obligaciones legales.',
      'Comunicaciones transaccionales (verificación de correo, recuperación de contraseña, avisos): ejecución del contrato.',
    ],
  },
  {
    heading: 'Con quién compartimos (encargados)',
    bullets: [
      'Proveedor de IA para orientación y resúmenes (por ejemplo, DeepSeek y Groq como respaldo).',
      'Jitsi self-hosted para la videollamada (previsto; mientras tanto puede usarse un servicio Jitsi público).',
      'Cloudinary para alojar archivos e imágenes que adjuntas.',
      'Proveedor de correo (SMTP) para mensajes transaccionales.',
      'Proveedor de hosting e infraestructura (Render) y base de datos.',
      'Pasarela de pagos cuando se integre; hoy los créditos son de prueba.',
    ],
    paragraphs: [
      'Se exige a los encargados medidas de seguridad y confidencialidad. Algunos pueden estar fuera de tu país, por lo que puede existir transferencia internacional de datos con las garantías aplicables.',
    ],
  },
  {
    heading: 'Cuánto tiempo los conservamos',
    paragraphs: [
      'Conservamos los datos mientras la cuenta esté activa y durante los plazos legales aplicables. Los registros de error técnico se conservan 60 días. Los datos clínicos se conservan según la normativa sanitaria correspondiente. Cuando dejan de ser necesarios, se eliminan o anonimizan.',
    ],
  },
  {
    heading: 'Tus derechos',
    bullets: [
      'Acceso, rectificación, supresión y portabilidad de tus datos.',
      'Oposición y limitación del tratamiento en los casos previstos por la ley.',
      'Retirar el consentimiento en cualquier momento, sin afectar la licitud previa.',
      'Presentar una reclamación ante la autoridad de protección de datos de tu país.',
    ],
    paragraphs: [
      'Puedes ejercer estos derechos desde tu perfil o escribiéndonos por los canales de soporte. Verificaremos tu identidad antes de responder.',
    ],
  },
  {
    heading: 'Seguridad',
    paragraphs: [
      'Aplicamos medidas técnicas y organizativas: cifrado de contraseñas, control de accesos por roles, registro de auditoría y registro de errores con datos sensibles enmascarados. Ningún sistema es 100 % infalible; si detectamos una brecha relevante, lo notificaremos según corresponda.',
    ],
  },
  {
    heading: 'Transcripción de consultas',
    paragraphs: [
      'Está previsto incorporar transcripción de la videoconsulta al historial clínico. Cuando se implemente, se solicitará un consentimiento específico, se informará si se almacena audio, texto o ambos, y se detallarán proveedor, finalidad y plazo de conservación.',
    ],
  },
  {
    heading: 'Cambios',
    paragraphs: [
      'Podemos actualizar esta política. Publicaremos la versión vigente con su fecha y, cuando el cambio sea sustancial, lo comunicaremos por los canales habituales.',
    ],
  },
]

export default function Privacy() {
  return (
    <LegalPage
      title="Política de privacidad"
      description="Cómo tratamos tus datos personales y de salud en SabioDoc."
      updated={LEGAL_UPDATED}
      version={LEGAL_VERSION}
      status={LEGAL_STATUS}
      intro={
        <p>
          SabioDoc trata datos personales y de salud. Esta política explica qué datos recogemos, para
          qué los usamos, con quién los compartimos y qué derechos tienes.
        </p>
      }
      sections={SECTIONS}
    />
  )
}
