import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/sante')({
  beforeLoad: () => {
    throw redirect({ to: '/secteurs/$sector', params: { sector: 'sante' }, replace: true })
  },
})
