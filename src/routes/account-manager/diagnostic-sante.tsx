import { createFileRoute } from '@tanstack/react-router'
import { QuestionnaireSante } from '@/features/health360/QuestionnaireSante'

export const Route = createFileRoute('/account-manager/diagnostic-sante')({
  component: QuestionnaireSantePage,
})

function QuestionnaireSantePage() {
  return <QuestionnaireSante />
}
