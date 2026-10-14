import LegalPage, { LegalSection } from '../components/LegalPage'

const SECTIONS: LegalSection[] = [
  {
    heading: 'Qué es la telemedicina',
    paragraphs: [
      'La telemedicina es la atención de salud a distancia mediante tecnologías de la comunicación. En SabioDoc, la videoconsulta permite al médico valorar tu caso de forma remota, dentro de sus límites.',
    ],
  },
  {
    heading: 'Qué NO cubre',
    bullets: [
      'Emergencias: ante dolor torácico, dificultad para respirar, signos de derrame, sangrado abundante o pérdida de consciencia, llama a emergencias.',
      'Atención que requiera exploración física, imágenes o procedimientos presenciales.',
      'Diagnósticos definitivos sin la información suficiente.',
    ],
  },
  {
    heading: 'Consentimiento informado',
    paragraphs: [
      'Antes de iniciar una videoconsulta confirmas que entiendes sus alcances y límites, que la información que brindas es veraz y que aceptas el tratamiento de tus datos clínicos. Puedes retirar tu consentimiento en cualquier momento, lo que puede impedir continuar la atención.',
    ],
  },
  {
    heading: 'Verificación de identidad',
    paragraphs: [
      'Paciente y médico deben identificarse con su nombre antes de iniciar. La plataforma registra quién entra a la sala y desde qué sesión, para tu seguridad y para la trazabilidad clínica.',
    ],
  },
  {
    heading: 'Privacidad de la videollamada',
    paragraphs: [
      'La videollamada se realiza mediante Jitsi. Actualmente se usan salas públicas de meet.jit.si; estamos migrando a un servicio con autenticación. Te recomendamos usar un lugar privado y una conexión de confianza.',
    ],
  },
  {
    heading: 'Transcripción y registro',
    paragraphs: [
      'Está previsto incorporar transcripción de la consulta al historial clínico. Cuando se active, se pedirá un consentimiento específico y se informará el proveedor, la finalidad y el plazo de conservación. Mientras no se implemente, no se transcribe ni graba la consulta.',
    ],
  },
  {
    heading: 'Receta y documentos',
    paragraphs: [
      'La plataforma facilita el intercambio de indicaciones y archivos entre paciente y médico. La validez de recetas o certificados depende de la normativa de tu país y de la firma del profesional.',
    ],
  },
]

export default function Telemedicine() {
  return (
    <LegalPage
      title="Política de telemedicina"
      description="Alcances, límites y consentimiento de la atención a distancia."
      updated="13 de octubre de 2026"
      intro={
        <p>
          Esta política describe cómo funciona la atención médica a distancia en SabioDoc y sus
          límites.
        </p>
      }
      sections={SECTIONS}
    />
  )
}
